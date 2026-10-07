import { prisma } from '../db';

function mapEvent(e: any) {
  const article = e.ingested_articles?.[0];
  const dateObj = article?.published_at ? new Date(article.published_at) : new Date(e.created_at);
  const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  return {
    ...e,
    id: e.id,
    date: formattedDate,
    time: formattedTime,
    signals: e.signals || [],
    classificationReason: e.classification_reason,
    classificationConfidence: e.classification_confidence ? Math.round(Number(e.classification_confidence) * 100) : undefined,
    sentimentDrivers: e.sentiment_drivers || [],
    sentimentConfidence: e.sentiment_confidence ? Math.round(Number(e.sentiment_confidence) * 100) : undefined,
    impactFactors: e.impact_factors || [],
    impactReason: e.impact_reason,
    impactConfidence: e.impact_confidence ? Math.round(Number(e.impact_confidence) * 100) : undefined,
    affectedAreas: e.affected_areas || [],
    riskFlow: e.risk_flow || [],
    sentiment: Number(e.sentiment),
    impact: Number(e.impact),
    url: article?.url || e.canonical_url || null,
    affectedAssets: e.affected_assets || [],
    relevanceType: e.relevance_type,
    relevanceReason: e.relevance_reason,
    relevanceScore: e.relevance_score ? Number(e.relevance_score) : null
  };
}

export class EventService {
  async listEvents(filters: { category?: string, sentiment?: number, impact?: number, horizon?: string, portfolioId?: string, source?: string, freshness?: string }) {
    const where: any = {};
    if (filters.category && filters.category !== 'All categories' && filters.category !== 'All') {
      where.category = filters.category;
    }
    if (filters.horizon && filters.horizon !== 'All horizons') {
      where.horizon = filters.horizon;
    }
    if (filters.sentiment !== undefined) {
      where.sentiment = {
        gte: -filters.sentiment,
        lte: filters.sentiment
      };
    }
    if (filters.impact !== undefined) {
      where.impact = { gte: filters.impact };
    }
    if (filters.source && filters.source !== 'All') {
      where.OR = [
        { source: { contains: filters.source, mode: 'insensitive' } },
        { primary_source: { contains: filters.source, mode: 'insensitive' } }
      ];
    }
    if (filters.freshness && filters.freshness !== 'All' && filters.freshness !== 'all') {
      const now = new Date();
      let cutoff: Date | null = null;
      if (filters.freshness === '1h' || filters.freshness === 'LAST_1_HOUR') cutoff = new Date(now.getTime() - 1 * 3600000);
      else if (filters.freshness === '6h' || filters.freshness === 'LAST_6_HOURS') cutoff = new Date(now.getTime() - 6 * 3600000);
      else if (filters.freshness === '24h' || filters.freshness === 'LAST_24_HOURS') cutoff = new Date(now.getTime() - 24 * 3600000);
      else if (filters.freshness === '3d' || filters.freshness === 'LAST_3_DAYS') cutoff = new Date(now.getTime() - 72 * 3600000);
      else if (filters.freshness === '7d' || filters.freshness === 'LAST_7_DAYS') cutoff = new Date(now.getTime() - 168 * 3600000);

      if (cutoff) {
        where.created_at = { gte: cutoff };
      }
    }

    where.title = {
      not: {
        startsWith: 'MOCK:'
      }
    };

    let events = await prisma.riskEvent.findMany({ 
      where,
      orderBy: { created_at: 'desc' },
      include: { ingested_articles: true }
    });
    
    // If a portfolioId is provided, filter events that are relevant to this portfolio
    if (filters.portfolioId) {
      const assets = await prisma.asset.findMany({ where: { portfolio_id: filters.portfolioId } });
      const tickers = assets.map(a => a.ticker).filter(Boolean);
      const companyNames = assets.map(a => a.company?.toLowerCase()).filter(Boolean);
      
      events = events.filter(e => {
        if (e.relevance_type === 'PORTFOLIO_WIDE') return true;
        
        const eventAssets = Array.isArray(e.affected_assets) ? e.affected_assets : [];
        if (eventAssets.length === 0 && e.relevance_type !== 'PORTFOLIO_WIDE') return false;
        
        // Match by ticker
        const hasTickerMatch = eventAssets.some(ticker => tickers.includes(String(ticker)));
        if (hasTickerMatch) return true;
        
        // Sometimes LLM might return company name instead of ticker, let's do a loose match if needed,
        // but for now strict matching on ticker returned by LLM or checking if it's broadly relevant
        const hasCompanyMatch = eventAssets.some(a => companyNames.some(c => c && c.includes(String(a).toLowerCase())));
        if (hasCompanyMatch) return true;
        
        return false;
      });
    }

    return events.map(mapEvent);
  }

  async getEventById(id: string) {
    const e = await prisma.riskEvent.findUnique({ 
      where: { id },
      include: { ingested_articles: true }
    });
    if (!e) return null;
    return mapEvent(e);
  }
}
