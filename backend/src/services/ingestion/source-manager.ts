import { randomUUID } from 'crypto';
import { prisma } from '../../db';
import { SourceConfig, SourceAdapter } from '../../types/ingestion.types';
import { INITIAL_TRUSTED_SOURCES } from '../../config/sources.config';
import { RssSourceAdapter } from '../../providers/news/rss.adapter';

export class SourceConfigError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
    this.name = 'SourceConfigError';
  }
}

export class SourceAdapterManager {
  private adapters: Map<string, SourceAdapter> = new Map();

  constructor() {
    // Register the universal RSS adapter
    const rssAdapter = new RssSourceAdapter();
    this.adapters.set('rss', rssAdapter);
  }

  async initializeSources(): Promise<SourceConfig[]> {
    let sources = await prisma.ingestionSourceConfig.findMany();
    const existingIds = new Set(sources.map(source => source.id));
    const missingDefaults = INITIAL_TRUSTED_SOURCES.filter(source => !existingIds.has(source.id));

    if (missingDefaults.length > 0) {
      // Seed missing defaults once; persisted rows remain the live source of truth.
      await prisma.ingestionSourceConfig.createMany({
        data: missingDefaults.map(s => ({
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
      sources = await prisma.ingestionSourceConfig.findMany();
    }

    return sources.map(source => this.toSourceConfig(source));
  }

  async getActiveAdapters(
    timeWindow: string,
    respectFetchIntervals = false
  ): Promise<Array<{ config: SourceConfig; adapter: SourceAdapter }>> {
    const configs = await this.initializeSources();
    const enabledConfigs = configs.filter(c => c.enabled);
    let dueSourceIds: Set<string> | undefined;

    if (respectFetchIntervals) {
      const schedules = await prisma.ingestionSourceConfig.findMany({
        where: { enabled: true },
        select: { id: true, fetch_interval: true, last_fetched_at: true }
      });
      const now = Date.now();
      dueSourceIds = new Set(schedules
        .filter(source =>
          !source.last_fetched_at ||
          now - source.last_fetched_at.getTime() >= source.fetch_interval * 60 * 1000
        )
        .map(source => source.id));
    }

    const activePairs: Array<{ config: SourceConfig; adapter: SourceAdapter }> = [];

    for (const config of enabledConfigs) {
      if (dueSourceIds && !dueSourceIds.has(config.id)) {
        continue;
      }
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

  async createSource(data: Omit<SourceConfig, 'id' | 'adapterType'>): Promise<SourceConfig> {
    const name = this.requireText(data.name, 'name');
    const domain = this.requireHttpUrl(data.domain, 'domain');
    const sourceType = this.requireText(data.sourceType, 'sourceType');
    const feedUrl = this.requireHttpUrl(data.feedUrl, 'feedUrl');
    this.validateLimits(data.fetchInterval, data.maxItemsPerRun);

    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `source-${randomUUID()}`;

    const existing = await prisma.ingestionSourceConfig.findUnique({ where: { id } });
    if (existing) {
      throw new SourceConfigError(`A source with the ID "${id}" already exists`, 409);
    }

    const created = await prisma.ingestionSourceConfig.create({
      data: {
        id,
        name,
        domain,
        source_type: sourceType,
        adapter_type: 'rss',
        feed_url: feedUrl,
        enabled: data.enabled,
        fetch_interval: data.fetchInterval,
        max_items_per_run: data.maxItemsPerRun
      }
    });

    return this.toSourceConfig(created);
  }

  async updateSource(id: string, data: Partial<SourceConfig>) {
    const updateData: {
      name?: string;
      domain?: string;
      source_type?: string;
      feed_url?: string;
      enabled?: boolean;
      fetch_interval?: number;
      max_items_per_run?: number;
    } = {};
    if (data.name !== undefined) updateData.name = this.requireText(data.name, 'name');
    if (data.domain !== undefined) updateData.domain = this.requireHttpUrl(data.domain, 'domain');
    if (data.sourceType !== undefined) updateData.source_type = this.requireText(data.sourceType, 'sourceType');
    if (data.feedUrl !== undefined) updateData.feed_url = this.requireHttpUrl(data.feedUrl, 'feedUrl');
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.fetchInterval !== undefined) updateData.fetch_interval = data.fetchInterval;
    if (data.maxItemsPerRun !== undefined) updateData.max_items_per_run = data.maxItemsPerRun;
    if (data.fetchInterval !== undefined || data.maxItemsPerRun !== undefined) {
      const current = await prisma.ingestionSourceConfig.findUniqueOrThrow({ where: { id } });
      this.validateLimits(
        data.fetchInterval ?? current.fetch_interval,
        data.maxItemsPerRun ?? current.max_items_per_run
      );
    }

    const updated = await prisma.ingestionSourceConfig.update({
      where: { id },
      data: updateData
    });

    return {
      ...this.toSourceConfig(updated)
    };
  }

  private toSourceConfig(source: {
    id: string;
    name: string;
    domain: string;
    source_type: string;
    adapter_type: string;
    feed_url: string;
    enabled: boolean;
    fetch_interval: number;
    max_items_per_run: number;
  }): SourceConfig {
    return {
      id: source.id,
      name: source.name,
      domain: source.domain,
      sourceType: source.source_type,
      adapterType: source.adapter_type,
      feedUrl: source.feed_url,
      enabled: source.enabled,
      fetchInterval: source.fetch_interval,
      maxItemsPerRun: source.max_items_per_run
    };
  }

  private requireText(value: string, field: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new SourceConfigError(`${field} is required`);
    }
    return trimmed;
  }

  private requireHttpUrl(value: string, field: string): string {
    const trimmed = this.requireText(value, field);
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new SourceConfigError(`${field} must be a valid HTTP or HTTPS URL`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new SourceConfigError(`${field} must be a valid HTTP or HTTPS URL`);
    }
    return parsed.toString();
  }

  private validateLimits(fetchInterval: number, maxItemsPerRun: number): void {
    if (!Number.isInteger(fetchInterval) || fetchInterval < 1) {
      throw new SourceConfigError('fetchInterval must be a positive whole number');
    }
    if (!Number.isInteger(maxItemsPerRun) || maxItemsPerRun < 1 || maxItemsPerRun > 100) {
      throw new SourceConfigError('maxItemsPerRun must be a whole number between 1 and 100');
    }
  }
}

export const sourceAdapterManager = new SourceAdapterManager();
