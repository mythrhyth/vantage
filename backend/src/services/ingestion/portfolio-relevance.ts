import { prisma } from '../../db';

export interface PortfolioRelevanceResult {
  relevant: boolean;
  relevanceType: 'DIRECT' | 'INDIRECT' | 'PORTFOLIO_WIDE' | 'IRRELEVANT';
  relevanceScore: number;
  relevanceReason: string;
  affectedAssets: string[];
}

export class PortfolioRelevanceFilter {
  async checkRelevance(text: string, title: string): Promise<PortfolioRelevanceResult> {
    const assets = await prisma.asset.findMany({ select: { ticker: true, company: true, sector: true } });
    
    const combined = (title + ' ' + text).toLowerCase();

    const macroKeywords = [
      'federal reserve', 'fed', 'fomc', 'interest rate', 'rate cut', 'rate hike',
      'inflation', 'cpi', 'ecb', 'european central bank', 'central bank',
      'recession', 'monetary policy', 'gdp', 'treasury yield', 'oil price',
      'crude oil', 'banking sector', 'systemic risk', 'credit crunch'
    ];

    const isMacro = macroKeywords.some(kw => combined.includes(kw));

    const directMatches: string[] = [];
    for (const asset of assets) {
      if (asset.ticker) {
        const tickerLower = asset.ticker.toLowerCase();
        const regex = new RegExp(`\\b${tickerLower}\\b`, 'i');
        if (regex.test(combined) || title.includes(asset.ticker)) {
          directMatches.push(asset.ticker);
        }
      }
      if (asset.company) {
        const companyWord = asset.company.split(' ')[0].toLowerCase().replace(/,/g, '');
        if (companyWord.length >= 3 && combined.includes(companyWord)) {
          if (asset.ticker && !directMatches.includes(asset.ticker)) {
            directMatches.push(asset.ticker);
          }
        }
      }
    }

    if (directMatches.length > 0) {
      return {
        relevant: true,
        relevanceType: 'DIRECT',
        relevanceScore: 0.95,
        relevanceReason: `Direct impact on portfolio asset(s): ${directMatches.join(', ')}`,
        affectedAssets: directMatches
      };
    }

    if (isMacro) {
      const allTickers = assets.map(a => a.ticker).filter(Boolean) as string[];
      return {
        relevant: true,
        relevanceType: 'PORTFOLIO_WIDE',
        relevanceScore: 0.90,
        relevanceReason: 'Macroeconomic/central bank event affecting broad portfolio holdings',
        affectedAssets: allTickers.slice(0, 4)
      };
    }

    const indirectMatches: string[] = [];
    for (const asset of assets) {
      if (asset.sector && combined.includes(asset.sector.toLowerCase())) {
        if (asset.ticker && !indirectMatches.includes(asset.ticker)) {
          indirectMatches.push(asset.ticker);
        }
      }
    }

    if (indirectMatches.length > 0) {
      return {
        relevant: true,
        relevanceType: 'INDIRECT',
        relevanceScore: 0.70,
        relevanceReason: `Indirect sector impact on assets: ${indirectMatches.join(', ')}`,
        affectedAssets: indirectMatches
      };
    }

    return {
      relevant: false,
      relevanceType: 'IRRELEVANT',
      relevanceScore: 0,
      relevanceReason: 'Article contains no direct or macro relevance to current portfolio holdings',
      affectedAssets: []
    };
  }
}

export const portfolioRelevanceFilter = new PortfolioRelevanceFilter();
