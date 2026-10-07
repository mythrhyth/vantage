export type FreshnessWindow = 
  | 'LAST_1_HOUR' 
  | 'LAST_6_HOURS' 
  | 'LAST_24_HOURS' 
  | 'LAST_3_DAYS' 
  | 'LAST_7_DAYS' 
  | 'CUSTOM';

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

export interface SourceConfig {
  id: string;
  name: string;
  domain: string;
  sourceType: string;
  adapterType: 'rss' | 'api';
  feedUrl: string;
  enabled: boolean;
  fetchInterval: number; // minutes
  maxItemsPerRun: number;
  lastFetchedAt?: Date | null;
  lastSuccessfulAt?: Date | null;
  lastError?: string | null;
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
  failed: number;
}
export interface RawArticle {
  externalId: string;
  source: string;
  title: string;
  content: string;
  url?: string;
  canonicalUrl?: string;
  publishedAt?: Date;
}

export interface IngestionSource {
  name: string;
  fetchLatest(): Promise<RawArticle[]>;
}
