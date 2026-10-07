import Parser from 'rss-parser';
import { IngestionSource, RawArticle } from './types';

export class CnbcIngestionSource implements IngestionSource {
  name = 'WSJ Finance RSS';
  private parser = new Parser();

  async fetchLatest(): Promise<RawArticle[]> {
    console.log(`[${this.name}] Fetching real articles from RSS feed...`);
    
    try {
      const feed = await this.parser.parseURL('https://feeds.a.dj.com/rss/RSSMarketsMain.xml');
      
      const articles: RawArticle[] = feed.items.map(item => ({
        externalId: item.guid || item.id || item.link,
        title: item.title || 'Untitled',
        content: (item.contentSnippet || item.content || item.summary || '') + '', 
        source: 'WSJ',
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
