import { prisma } from '../db';
import { INITIAL_TRUSTED_SOURCES } from './sources.config';
import { SourceConfig, SourceAdapter, FreshnessWindow, NormalizedArticle } from './types';
import { RssSourceAdapter } from './adapters/rss.adapter';

export class SourceManager {
  private rssAdapter = new RssSourceAdapter();

  /**
   * Ensure default trusted sources exist in database
   */
  async initDefaultSources() {
    for (const src of INITIAL_TRUSTED_SOURCES) {
      const existing = await prisma.ingestionSourceConfig.findUnique({
        where: { id: src.id }
      });
      if (!existing) {
        await prisma.ingestionSourceConfig.create({
          data: {
            id: src.id,
            name: src.name,
            domain: src.domain,
            source_type: src.sourceType,
            adapter_type: src.adapterType,
            feed_url: src.feedUrl,
            enabled: src.enabled,
            fetch_interval: src.fetchInterval,
            max_items_per_run: src.maxItemsPerRun
          }
        });
      }
    }

    // Ensure default system settings exist
    const settings = await prisma.ingestionSystemSettings.findUnique({
      where: { id: 'default' }
    });
    if (!settings) {
      await prisma.ingestionSystemSettings.create({
        data: {
          id: 'default',
          freshness_window: 'LAST_24_HOURS',
          max_items_per_source: 20,
          auto_analyze: true,
          deduplicate_similar: true,
          similarity_threshold: 0.85
        }
      });
    }
  }

  /**
   * List all configured sources
   */
  async listSources(): Promise<SourceConfig[]> {
    await this.initDefaultSources();
    const rows = await prisma.ingestionSourceConfig.findMany({
      orderBy: { name: 'asc' }
    });
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      domain: r.domain,
      sourceType: r.source_type,
      adapterType: r.adapter_type as 'rss' | 'api',
      feedUrl: r.feed_url,
      enabled: r.enabled,
      fetchInterval: r.fetch_interval,
      maxItemsPerRun: r.max_items_per_run
    }));
  }

  /**
   * Get system settings
   */
  async getSettings() {
    await this.initDefaultSources();
    return await prisma.ingestionSystemSettings.findUnique({
      where: { id: 'default' }
    });
  }

  /**
   * Update system settings
   */
  async updateSettings(data: {
    freshnessWindow?: string;
    maxItemsPerSource?: number;
    autoAnalyze?: boolean;
    deduplicateSimilar?: boolean;
    similarityThreshold?: number;
  }) {
    return await prisma.ingestionSystemSettings.update({
      where: { id: 'default' },
      data: {
        freshness_window: data.freshnessWindow,
        max_items_per_source: data.maxItemsPerSource,
        auto_analyze: data.autoAnalyze,
        deduplicate_similar: data.deduplicateSimilar,
        similarity_threshold: data.similarityThreshold
      }
    });
  }

  /**
   * Toggle source enabled status
   */
  async toggleSource(id: string, enabled: boolean) {
    return await prisma.ingestionSourceConfig.update({
      where: { id },
      data: { enabled }
    });
  }

  /**
   * Add a new supported ingestion source
   */
  async addSource(data: {
    id: string;
    name: string;
    domain: string;
    sourceType: string;
    adapterType: 'rss' | 'api';
    feedUrl: string;
    enabled?: boolean;
    fetchInterval?: number;
    maxItemsPerRun?: number;
  }) {
    return await prisma.ingestionSourceConfig.create({
      data: {
        id: data.id,
        name: data.name,
        domain: data.domain,
        source_type: data.sourceType,
        adapter_type: data.adapterType,
        feed_url: data.feedUrl,
        enabled: data.enabled ?? true,
        fetch_interval: data.fetchInterval ?? 15,
        max_items_per_run: data.maxItemsPerRun ?? 20
      }
    });
  }

  /**
   * Edit/Update an existing source configuration
   */
  async updateSource(id: string, data: {
    name?: string;
    domain?: string;
    sourceType?: string;
    adapterType?: 'rss' | 'api';
    feedUrl?: string;
    enabled?: boolean;
    fetchInterval?: number;
    maxItemsPerRun?: number;
  }) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.domain !== undefined) updateData.domain = data.domain;
    if (data.sourceType !== undefined) updateData.source_type = data.sourceType;
    if (data.adapterType !== undefined) updateData.adapter_type = data.adapterType;
    if (data.feedUrl !== undefined) updateData.feed_url = data.feedUrl;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.fetchInterval !== undefined) updateData.fetch_interval = data.fetchInterval;
    if (data.maxItemsPerRun !== undefined) updateData.max_items_per_run = data.maxItemsPerRun;

    return await prisma.ingestionSourceConfig.update({
      where: { id },
      data: updateData
    });
  }

  /**
   * Remove/Deactivate source
   */
  async deleteSource(id: string) {
    return await prisma.ingestionSourceConfig.delete({
      where: { id }
    });
  }

  /**
   * Select adapter for a source config
   */
  getAdapter(config: SourceConfig): SourceAdapter {
    return this.rssAdapter;
  }

  /**
   * Fetch articles for a source config respecting time window
   */
  async fetchFromSource(config: SourceConfig, timeWindow: FreshnessWindow): Promise<NormalizedArticle[]> {
    if (!config.enabled) return [];
    
    const adapter = this.getAdapter(config);
    try {
      const articles = await adapter.fetch(config, timeWindow);
      await prisma.ingestionSourceConfig.update({
        where: { id: config.id },
        data: {
          last_fetched_at: new Date(),
          last_successful_at: new Date(),
          last_error: null
        }
      });
      return articles;
    } catch (e: any) {
      await prisma.ingestionSourceConfig.update({
        where: { id: config.id },
        data: {
          last_fetched_at: new Date(),
          last_error: e.message
        }
      });
      return [];
    }
  }
}

export const sourceManager = new SourceManager();
