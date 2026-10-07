import crypto from 'crypto';
import { prisma } from '../db';
import { sourceManager } from './source-manager';
import { portfolioRelevanceFilter } from './portfolio-relevance';
import { eventClusteringEngine } from './event-clustering';
import { nlpService } from '../services/nlp/nlp.service';
import { FreshnessWindow, IngestionStats, NormalizedArticle } from './types';

export class IngestionService {
  /**
   * Run full multi-source ingestion cycle
   */
  async runIngestion(overrideWindow?: FreshnessWindow): Promise<IngestionStats> {
    const settings = await sourceManager.getSettings();
    const window = (overrideWindow || settings?.freshness_window || 'LAST_24_HOURS') as FreshnessWindow;
    const threshold = settings?.similarity_threshold || 0.85;

    console.log(`[IngestionService] Starting multi-source ingestion cycle. Window: ${window}, Similarity Threshold: ${threshold}`);

    const stats: IngestionStats = {
      sourcesFetched: 0,
      totalFetched: 0,
      withinTimeWindow: 0,
      exactDuplicates: 0,
      deterministicIrrelevant: 0,
      crossSourceSimilar: 0,
      geminiAnalyzed: 0,
      portfolioRelevant: 0,
      portfolioIrrelevant: 0,
      riskEventsCreated: 0,
      failed: 0
    };

    const sources = await sourceManager.listSources();
    const enabledSources = sources.filter(s => s.enabled);
    stats.sourcesFetched = enabledSources.length;

    for (const sourceConfig of enabledSources) {
      console.log(`[IngestionService] Processing source: ${sourceConfig.name}`);
      const articles = await sourceManager.fetchFromSource(sourceConfig, window);
      stats.totalFetched += articles.length;
      stats.withinTimeWindow += articles.length;

      for (const article of articles) {
        if (!article.content || article.content.trim() === '') continue;

        const contentHash = crypto.createHash('sha256').update(article.content).digest('hex');

        // STAGE 1: Exact Duplicate Filter (external_id -> canonical_url -> content_hash)
        let existing = await prisma.ingestedArticle.findFirst({
          where: {
            OR: [
              { source: article.source, external_id: article.externalId },
              { source: article.source, canonical_url: article.canonicalUrl || article.url },
              { source: article.source, url: article.url },
              { source: article.source, content_hash: contentHash }
            ]
          }
        });

        if (existing) {
          stats.exactDuplicates++;
          continue;
        }

        // STAGE 2: Portfolio Relevance Filter
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
              processing_status: 'IRRELEVANT',
              processed_at: new Date()
            }
          });
          continue;
        }

        stats.portfolioRelevant++;

        // Create initial Discovered/Processing record
        const ingested = await prisma.ingestedArticle.create({
          data: {
            source: article.source,
            external_id: article.externalId,
            title: article.title,
            url: article.url,
            canonical_url: article.canonicalUrl,
            content: article.content,
            content_hash: contentHash,
            published_at: article.publishedAt,
            processing_status: 'PROCESSING'
          }
        });

        try {
          // STAGE 3: Cross-Source Event Clustering (if enabled)
          const dedupeSimilar = settings?.deduplicate_similar ?? true;
          let clusterResult: { clustered: boolean; riskEventId?: string; similarityScore?: number } = { clustered: false };

          if (dedupeSimilar) {
            clusterResult = await eventClusteringEngine.findCluster(article, threshold);
          }

          if (clusterResult.clustered && clusterResult.riskEventId) {
            stats.crossSourceSimilar++;
            await eventClusteringEngine.attachToCluster(article, clusterResult.riskEventId, ingested.id);
            console.log(`[IngestionService] Article "${article.title}" clustered into existing RiskEvent ${clusterResult.riskEventId} (Similarity: ${clusterResult.similarityScore})`);
            continue;
          }

          // STAGE 4: Gemini Risk Analysis & RiskEvent Creation
          stats.geminiAnalyzed++;
          
          const riskEvent = await nlpService.analyzeAndPersist(
            {
              title: article.title,
              source: article.source,
              publishedAt: article.publishedAt.toISOString(),
              excerpt: article.content.substring(0, 300) + (article.content.length > 300 ? '...' : '')
            },
            article.content,
            {
              relevant: true,
              relevanceType: relevance.relevanceType,
              relevanceScore: relevance.relevanceScore,
              relevanceReason: relevance.relevanceReason,
              affectedAssets: relevance.affectedAssets,
              portfolioWide: relevance.relevanceType === 'PORTFOLIO_WIDE'
            }
          );

          // Update RiskEvent with canonical URL and initial source metadata
          await prisma.riskEvent.update({
            where: { id: riskEvent.id },
            data: {
              canonical_url: article.url,
              source_count: 1,
              additional_sources: [
                {
                  source: article.source,
                  sourceType: article.sourceType,
                  url: article.url,
                  canonicalUrl: article.canonicalUrl || article.url,
                  externalId: article.externalId,
                  publishedAt: article.publishedAt.toISOString(),
                  title: article.title
                }
              ] as any
            }
          });

          await prisma.ingestedArticle.update({
            where: { id: ingested.id },
            data: {
              processing_status: 'PROCESSED',
              processed_at: new Date(),
              risk_event_id: riskEvent.id
            }
          });

          stats.riskEventsCreated++;
          console.log(`[IngestionService] Successfully created new RiskEvent: ${riskEvent.id} for "${article.title}"`);
        } catch (e: any) {
          stats.failed++;
          console.error(`[IngestionService] Analysis/Clustering failed for "${article.title}":`, e.message);
          await prisma.ingestedArticle.update({
            where: { id: ingested.id },
            data: { processing_status: 'FAILED', processed_at: new Date() }
          });
        }
      }
    }

    console.log(`[IngestionService] Cycle completed. Stats:`, JSON.stringify(stats, null, 2));
    return stats;
  }
}

export const ingestionService = new IngestionService();
