import { prisma } from '../../db';
import { NormalizedArticle } from '../../types/ingestion.types';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'up', 'about', 'into', 'over', 'after', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
]);

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  
  const tokenSet = new Set<string>();
  for (const w of words) {
    tokenSet.add(w);
    if (w === 'fed' || w === 'fomc' || w === 'reserve' || w === 'federal' || w === 'bankers') {
      tokenSet.add('fed_central_bank');
    }
    if (w === 'rate' || w === 'rates' || w === 'interest') {
      tokenSet.add('interest_rate_policy');
    }
    if (w === 'hike' || w === 'raise' || w === 'high' || w === 'restrictive' || w === 'tight' || w === 'prolonged' || w === 'longer' || w === 'stay') {
      tokenSet.add('monetary_tightening');
    }
    if (w === 'policy' || w === 'stance' || w === 'signals' || w === 'support' || w === 'agreed') {
      tokenSet.add('policy_consensus');
    }
    if (w === 'inflation' || w === 'price' || w === 'stability' || w === 'curb' || w === 'pressures') {
      tokenSet.add('inflation_target');
    }
  }
  return tokenSet;
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

export interface ClusteringResult {
  clustered: boolean;
  riskEventId?: string;
  similarityScore?: number;
}

export class EventClusteringEngine {
  calculateSimilarity(article: NormalizedArticle, existingEvent: any): number {
    const articleTitleTokens = tokenize(article.title);
    const eventTitleTokens = tokenize(existingEvent.title);

    const productKeywords = ['launch', 'unveil', 'release', 'product', 'iphone', 'new'];
    const legalKeywords = ['probe', 'investigation', 'lawsuit', 'fine', 'regulator', 'sue', 'court', 'antitrust'];

    const articleTitleLower = article.title.toLowerCase();
    const eventTitleLower = (existingEvent.title || '').toLowerCase();

    const isArticleProduct = productKeywords.some(k => articleTitleLower.includes(k));
    const isEventLegal = legalKeywords.some(k => eventTitleLower.includes(k));

    const isArticleLegal = legalKeywords.some(k => articleTitleLower.includes(k));
    const isEventProduct = productKeywords.some(k => eventTitleLower.includes(k));

    if ((isArticleProduct && isEventLegal) || (isArticleLegal && isEventProduct)) {
      return 0;
    }

    let titleSim = jaccardSimilarity(articleTitleTokens, eventTitleTokens);

    const conceptTokensA = new Set([...articleTitleTokens].filter(t => t.includes('_')));
    const conceptTokensB = new Set([...eventTitleTokens].filter(t => t.includes('_')));
    const conceptSim = jaccardSimilarity(conceptTokensA, conceptTokensB);
    if (conceptSim >= 0.5) {
      titleSim = Math.min(1.0, titleSim + 0.40);
    }

    const articleContentTokens = tokenize(article.content);
    const eventExcerptTokens = tokenize(existingEvent.excerpt || existingEvent.title);
    const contentSim = jaccardSimilarity(articleContentTokens, eventExcerptTokens);

    const eventDate = new Date(existingEvent.created_at || existingEvent.published_at || new Date());
    const hoursDiff = Math.abs(article.publishedAt.getTime() - eventDate.getTime()) / (1000 * 60 * 60);
    const timeProximity = Math.max(0, 1 - hoursDiff / 48);

    const totalScore = (titleSim * 0.60) + (contentSim * 0.25) + (timeProximity * 0.15);
    return Number(totalScore.toFixed(3));
  }

  async findCluster(article: NormalizedArticle, threshold: number = 0.85, daysCutoff: number = 7): Promise<ClusteringResult> {
    const cutoff = new Date(Date.now() - daysCutoff * 24 * 60 * 60 * 1000);
    
    const recentEvents = await prisma.riskEvent.findMany({
      where: {
        created_at: { gte: cutoff }
      },
      include: {
        ingested_articles: true
      }
    });

    let bestMatch: { eventId: string; score: number } | null = null;

    for (const event of recentEvents) {
      const score = this.calculateSimilarity(article, event);
      if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { eventId: event.id, score };
      }
    }

    if (bestMatch) {
      return {
        clustered: true,
        riskEventId: bestMatch.eventId,
        similarityScore: bestMatch.score
      };
    }

    return { clustered: false };
  }

  async attachToCluster(article: NormalizedArticle, riskEventId: string, articleId: string) {
    const existing = await prisma.riskEvent.findUnique({
      where: { id: riskEventId }
    });

    if (!existing) return;

    let additionalSources: any[] = Array.isArray(existing.additional_sources) 
      ? (existing.additional_sources as any[]) 
      : [];

    const sourceExists = additionalSources.some(s => s.source === article.source && s.url === article.url) || existing.source === article.source;

    if (!sourceExists) {
      additionalSources.push({
        source: article.source,
        sourceType: article.sourceType,
        url: article.url,
        canonicalUrl: article.canonicalUrl || article.url,
        externalId: article.externalId,
        publishedAt: article.publishedAt.toISOString(),
        title: article.title
      });

      await prisma.riskEvent.update({
        where: { id: riskEventId },
        data: {
          source_count: (existing.source_count || 1) + 1,
          additional_sources: additionalSources as any
        }
      });
    }

    await prisma.ingestedArticle.update({
      where: { id: articleId },
      data: {
        risk_event_id: riskEventId,
        processing_status: 'CLUSTERED',
        processed_at: new Date()
      }
    });
  }
}

export const eventClusteringEngine = new EventClusteringEngine();
