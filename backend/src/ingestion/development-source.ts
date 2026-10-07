import { IngestionSource, RawArticle } from './types';

export class DevelopmentIngestionSource implements IngestionSource {
  name = 'DEVELOPMENT INGESTION SOURCE';

  async fetchLatest(): Promise<RawArticle[]> {
    console.log(`[${this.name}] Fetching mock articles...`);
    
    // Simulate real internet source NOT configured
    return [
      {
        externalId: 'dev-12345',
        title: 'Central Bank Unexpectedly Raises Interest Rates',
        content: 'In a surprise move, the central bank has raised interest rates by 50 basis points to combat stubborn inflation, causing shockwaves through equity and bond markets.',
        source: this.name,
        publishedAt: new Date()
      },
      {
        externalId: 'dev-67890',
        title: 'Major Tech Firm Warns of Slower Growth',
        content: 'A leading technology company has lowered its revenue guidance for the upcoming quarter, citing macroeconomic headwinds and reduced consumer spending.',
        source: this.name,
        publishedAt: new Date()
      },
      {
        externalId: 'dev-invalid-1',
        title: 'Short article',
        content: '', // Should be caught by normalization/NLP validation
        source: this.name,
        publishedAt: new Date()
      },
      // Duplicate for testing
      {
        externalId: 'dev-12345',
        title: 'Central Bank Unexpectedly Raises Interest Rates',
        content: 'In a surprise move, the central bank has raised interest rates by 50 basis points to combat stubborn inflation, causing shockwaves through equity and bond markets.',
        source: this.name,
        publishedAt: new Date()
      },
      // Same title, different ID/content
      {
        externalId: 'dev-12345-update',
        title: 'Central Bank Unexpectedly Raises Interest Rates',
        content: 'Update: Analysts warn the 50 basis point hike could trigger a mild recession next year.',
        source: this.name,
        publishedAt: new Date()
      }
    ];
  }
}
