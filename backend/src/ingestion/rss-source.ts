import Parser from 'rss-parser';
import { IngestionSource, RawArticle } from './types';

export class RssIngestionSource implements IngestionSource {
  name = 'NYT Business RSS';
  private parser = new Parser();

  async fetchLatest(): Promise<RawArticle[]> {
    console.log(`[${this.name}] Fetching real articles from RSS feed...`);
    
    try {
      const feed = await this.parser.parseURL('https://rss.nytimes.com/services/xml/rss/nyt/Business.xml');
      
      const articles: RawArticle[] = feed.items.map(item => ({
        externalId: item.guid || item.id || item.link,
        title: item.title || 'Untitled',
        content: (item.contentSnippet || item.content || item.summary || '') + '', // Make sure there's enough text for NLP
        source: 'NYT',
        url: item.link,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date()
      }));

      // Filter out empty items
      return articles.filter(a => a.content && a.content.length > 50).slice(0, 10);
    } catch (error) {
      console.error(`[${this.name}] Error fetching RSS feed:`, error);
      return [];
    }
  }
}
