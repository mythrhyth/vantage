export type FreshnessWindow = 'LAST_1_HOUR' | 'LAST_6_HOURS' | 'LAST_24_HOURS' | 'LAST_3_DAYS' | 'LAST_7_DAYS' | 'CUSTOM';

export interface SourceConfig {
  id: string;
  name: string;
  domain: string;
  sourceType: string;
  adapterType: string;
  feedUrl: string;
  enabled: boolean;
  fetchInterval: number;
  maxItemsPerRun: number;
}

export interface NormalizedArticle {
  externalId: string;
  source: string;
  sourceType: string;
  title: string;
  url: string;
  canonicalUrl?: string;
  content: string;
  publishedAt: Date;
  author?: string;
  fetchedAt: Date;
}

export interface SourceAdapter {
  id: string;
  name: string;
  fetch(config: SourceConfig, timeWindow: FreshnessWindow): Promise<NormalizedArticle[]>;
}

export interface IngestionStats {
  sourcesFetched: number;
  totalFetched: number;
  withinTimeWindow: number;
  exactDuplicates: number;
  deterministicIrrelevant: number;
  crossSourceSimilar: number;
  geminiAnalyzed: number;
  portfolioRelevant: number;
  portfolioIrrelevant: number;
  riskEventsCreated: number;
}
