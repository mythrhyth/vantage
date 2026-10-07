import Parser from 'rss-parser';
import { SourceAdapter, SourceConfig, FreshnessWindow, NormalizedArticle } from '../../types/ingestion.types';

export class RssSourceAdapter implements SourceAdapter {
  id = 'rss-adapter';
  name = 'Generic RSS Adapter';
  private parser = new Parser({
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FinancialRiskIntelligencePlatform/1.0',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    },
    timeout: 10000,
  });

  private calculateCutoff(window: FreshnessWindow): Date {
    const now = new Date();
    switch (window) {
      case 'LAST_1_HOUR':
        return new Date(now.getTime() - 1 * 60 * 60 * 1000);
      case 'LAST_6_HOURS':
        return new Date(now.getTime() - 6 * 60 * 60 * 1000);
      case 'LAST_24_HOURS':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'LAST_3_DAYS':
        return new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      case 'LAST_7_DAYS':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'CUSTOM':
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  async fetch(config: SourceConfig, timeWindow: FreshnessWindow): Promise<NormalizedArticle[]> {
    console.log(`[RssSourceAdapter] Fetching feed for source "${config.name}" from ${config.feedUrl}`);
    const cutoff = this.calculateCutoff(timeWindow);

    try {
      const feed = await this.parser.parseURL(config.feedUrl);
      const items = feed.items || [];
      const now = new Date();

      const normalized: NormalizedArticle[] = [];

      for (const item of items) {
        if (!item.title || item.title.trim() === '') continue;

        // Preserve ORIGINAL article URL. Never replace with homepage or generated fallback domain.
        const originalUrl = (item.link && item.link.trim() !== '') ? item.link.trim() : (item.guid && item.guid.startsWith('http') ? item.guid.trim() : null);
        if (!originalUrl) continue;
        const externalId = item.guid || item.id || originalUrl;

        // Extract content / excerpt
        const rawContent = item.contentSnippet || item.content || item.summary || item.title || '';
        const cleanContent = rawContent.replace(/<[^>]*>?/gm, '').trim();

        if (cleanContent.length < 20) continue;

        // Publication date logic
        let pubDate: Date | null = null;
        if (item.pubDate) {
          const parsed = new Date(item.pubDate);
          if (!isNaN(parsed.getTime())) pubDate = parsed;
        }
        if (!pubDate && item.isoDate) {
          const parsed = new Date(item.isoDate);
          if (!isNaN(parsed.getTime())) pubDate = parsed;
        }

        if (!pubDate) {
          pubDate = now;
        }

        if (pubDate < cutoff) {
          continue;
        }

        normalized.push({
          externalId,
          source: config.name,
          sourceType: config.sourceType,
          title: item.title.trim(),
          url: originalUrl,
          canonicalUrl: originalUrl,
          content: cleanContent,
          publishedAt: pubDate,
          author: item.creator || item.author || undefined,
          fetchedAt: now
        });

        if (normalized.length >= config.maxItemsPerRun) {
          break;
        }
      }

      console.log(`[RssSourceAdapter] Parsed ${normalized.length} articles within freshness window (${timeWindow}) for ${config.name}`);
      return normalized;
    } catch (error: any) {
      console.error(`[RssSourceAdapter] Error fetching RSS feed for ${config.name}:`, error.message);
      throw error;
    }
  }
}
