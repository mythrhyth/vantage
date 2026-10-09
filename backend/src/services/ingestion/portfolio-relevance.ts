import { entityResolver, PortfolioRelevanceAnalysis } from './entity-resolver';

export interface PortfolioRelevanceResult {
  relevant: boolean;
  relevanceType: 'DIRECT' | 'INDIRECT' | 'PORTFOLIO_WIDE' | 'IRRELEVANT';
  relevanceScore: number;
  relevanceReason: string;
  affectedAssets: string[];
}

export class PortfolioRelevanceFilter {
  /**
   * Delegates relevance evaluation to the new deterministic EntityResolver engine,
   * preserving 100% backward compatibility for all callers.
   */
  async checkRelevance(text: string, title: string, portfolioId?: string): Promise<PortfolioRelevanceResult> {
    const analysis: PortfolioRelevanceAnalysis = await entityResolver.evaluatePortfolioRelevance(text, title, portfolioId);

    return {
      relevant: analysis.relevant,
      relevanceType: analysis.relevanceType,
      relevanceScore: analysis.relevanceScore,
      relevanceReason: analysis.relevanceReason,
      affectedAssets: analysis.affectedAssets
    };
  }
}

export const portfolioRelevanceFilter = new PortfolioRelevanceFilter();
