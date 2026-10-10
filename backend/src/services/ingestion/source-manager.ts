import { prisma } from '../../db';
import { SourceConfig, SourceAdapter } from '../../types/ingestion.types';
import { INITIAL_TRUSTED_SOURCES } from '../../config/sources.config';
import { RssSourceAdapter } from '../../providers/news/rss.adapter';

export class SourceAdapterManager {
  private adapters: Map<string, SourceAdapter> = new Map();

  constructor() {
    // Register the universal RSS adapter
    const rssAdapter = new RssSourceAdapter();
    this.adapters.set('rss', rssAdapter);
  }

  async initializeSources(): Promise<SourceConfig[]> {
    await prisma.ingestionSourceConfig.createMany({
      data: INITIAL_TRUSTED_SOURCES.map(s => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        source_type: s.sourceType,
        adapter_type: s.adapterType,
        feed_url: s.feedUrl,
        enabled: s.enabled,
        fetch_interval: s.fetchInterval,
        max_items_per_run: s.maxItemsPerRun
      })),
      skipDuplicates: true
    });

    const existing = await prisma.ingestionSourceConfig.findMany();
    return existing.map(s => ({
      id: s.id,
      name: s.name,
      domain: s.domain,
      sourceType: s.source_type,
      adapterType: s.adapter_type,
      feedUrl: s.feed_url,
      enabled: s.enabled,
      fetchInterval: s.fetch_interval,
      maxItemsPerRun: s.max_items_per_run
    }));
  }

  async getActiveAdapters(timeWindow: string): Promise<Array<{ config: SourceConfig; adapter: SourceAdapter }>> {
    const configs = await this.initializeSources();
    const enabledConfigs = configs.filter(c => c.enabled);

    const activePairs: Array<{ config: SourceConfig; adapter: SourceAdapter }> = [];

    for (const config of enabledConfigs) {
      const adapter = this.adapters.get(config.adapterType) || this.adapters.get('rss');
      if (adapter) {
        activePairs.push({ config, adapter });
      } else {
        console.warn(`[SourceAdapterManager] No adapter found for type: ${config.adapterType}`);
      }
    }

    return activePairs;
  }

  async toggleSource(id: string, enabled: boolean) {
    const updated = await prisma.ingestionSourceConfig.update({
      where: { id },
      data: { enabled }
    });
    return {
      id: updated.id,
      name: updated.name,
      enabled: updated.enabled
    };
  }

  async updateSource(id: string, data: Partial<SourceConfig>) {
    const updateData: any = {};
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.fetchInterval !== undefined) updateData.fetch_interval = data.fetchInterval;
    if (data.maxItemsPerRun !== undefined) updateData.max_items_per_run = data.maxItemsPerRun;
    if (data.feedUrl !== undefined) updateData.feed_url = data.feedUrl;

    const updated = await prisma.ingestionSourceConfig.update({
      where: { id },
      data: updateData
    });

    return {
      id: updated.id,
      name: updated.name,
      domain: updated.domain,
      sourceType: updated.source_type,
      adapterType: updated.adapter_type,
      feedUrl: updated.feed_url,
      enabled: updated.enabled,
      fetchInterval: updated.fetch_interval,
      maxItemsPerRun: updated.max_items_per_run
    };
  }
}

export const sourceAdapterManager = new SourceAdapterManager();
