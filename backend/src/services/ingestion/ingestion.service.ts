import crypto from 'crypto';
import { prisma } from '../../db';
import { NormalizedArticle, IngestionStats } from '../../types/ingestion.types';
import { sourceAdapterManager } from './source-manager';
import { portfolioRelevanceFilter } from './portfolio-relevance';
import { eventClusteringEngine } from './event-clustering';
import { nlpService } from '../../providers/nlp/nlp.service';

export class IngestionService {
  private calculateHash(content: string): string {
    return crypto.createHash('sha256').update(content.trim()).digest('hex');
  }

  async runIngestion(
    window: string = 'LAST_24_HOURS',
    respectSourceIntervals = false
  ): Promise<{ success: boolean; stats: IngestionStats }> {
    console.log(`[IngestionService] Starting multi-source ingestion cycle. Window: ${window}`);
    
    const settings = await prisma.ingestionSystemSettings.findFirst() || await prisma.ingestionSystemSettings.create({ data: { id: 'default' } });
    const timeWindow = (window || settings.freshness_window) as any;
    const similarityThreshold = settings.similarity_threshold;

    const activePairs = await sourceAdapterManager.getActiveAdapters(timeWindow, respectSourceIntervals);

    const stats: IngestionStats = {
      sourcesFetched: activePairs.length,
      totalFetched: 0,
      withinTimeWindow: 0,
      exactDuplicates: 0,
      deterministicIrrelevant: 0,
      crossSourceSimilar: 0,
      geminiAnalyzed: 0,
      portfolioRelevant: 0,
      portfolioIrrelevant: 0,
      riskEventsCreated: 0
    };

    for (const { config, adapter } of activePairs) {
      try {
        const articles = await adapter.fetch(config, timeWindow);
        stats.totalFetched += articles.length;
        stats.withinTimeWindow += articles.length;

        for (const article of articles) {
          const contentHash = this.calculateHash(article.content);

          // EXACT DEDUPLICATION: Check database for content_hash or (source, external_id)
          const existingArticle = await prisma.ingestedArticle.findFirst({
            where: {
              OR: [
                { source: article.source, external_id: article.externalId },
                { source: article.source, content_hash: contentHash }
              ]
            }
          });

          if (existingArticle) {
            stats.exactDuplicates++;
            continue;
          }

          // Deterministic Portfolio Relevance Check
          const relevance = await portfolioRelevanceFilter.checkRelevance(article.content, article.title);

          if (!relevance.relevant) {
            stats.deterministicIrrelevant++;
            stats.portfolioIrrelevant++;
            
            await prisma.ingestedArticle.create({
              data: {
                source: article.source,
                external_id: article.externalId,
                title: article.title,
                url: article.url,
                canonical_url: article.canonicalUrl,
                content: article.content,
                content_hash: contentHash,
                published_at: article.publishedAt,
                processing_status: 'IRRELEVANT'
              }
            });
            continue;
          }

          stats.portfolioRelevant++;

          // CROSS-SOURCE SIMILARITY & EVENT DEDUPLICATION
          const clusterResult = await eventClusteringEngine.findCluster(article, similarityThreshold);

          // Save ingested article first
          const savedArticle = await prisma.ingestedArticle.create({
            data: {
              source: article.source,
              external_id: article.externalId,
              title: article.title,
              url: article.url,
              canonical_url: article.canonicalUrl,
              content: article.content,
              content_hash: contentHash,
              published_at: article.publishedAt,
              processing_status: clusterResult.clustered ? 'CLUSTERED' : 'PENDING'
            }
          });

          if (clusterResult.clustered && clusterResult.riskEventId) {
            stats.crossSourceSimilar++;
            await eventClusteringEngine.attachToCluster(article, clusterResult.riskEventId, savedArticle.id);
            console.log(`[IngestionService] Article "${article.title}" clustered into existing RiskEvent ${clusterResult.riskEventId}`);
            continue;
          }

          // Analyze with Gemini AI NLP provider
          stats.geminiAnalyzed++;
          const textToAnalyze = `${article.title}\n\n${article.content}`;
          const riskEvent = await nlpService.analyzeAndPersist(
            { title: article.title, source: article.source, publishedAt: article.publishedAt.toISOString(), excerpt: article.content.substring(0, 300) },
            textToAnalyze,
            {
              relevant: true,
              relevanceType: relevance.relevanceType,
              affectedAssets: relevance.affectedAssets,
              relevanceScore: relevance.relevanceScore,
              relevanceReason: relevance.relevanceReason
            }
          );

          if (riskEvent) {
            stats.riskEventsCreated++;
            await prisma.ingestedArticle.update({
              where: { id: savedArticle.id },
              data: {
                risk_event_id: riskEvent.id,
                processing_status: 'PROCESSED',
                processed_at: new Date()
              }
            });
            console.log(`[IngestionService] Created new RiskEvent ID ${riskEvent.id} for article "${article.title}"`);
          }
        }

        // Update last fetched timestamp for source
        await prisma.ingestionSourceConfig.update({
          where: { id: config.id },
          data: {
            last_fetched_at: new Date(),
            last_successful_at: new Date(),
            last_error: null
          }
        });

      } catch (error: any) {
        console.error(`[IngestionService] Ingestion failed for source ${config.name}:`, error.message);
        await prisma.ingestionSourceConfig.update({
          where: { id: config.id },
          data: {
            last_fetched_at: new Date(),
            last_error: error.message
          }
        }).catch(() => {});
      }
    }

    console.log(`[IngestionService] Ingestion cycle complete. Stats:`, JSON.stringify(stats, null, 2));
    return { success: true, stats };
  }
}

export const ingestionService = new IngestionService();
