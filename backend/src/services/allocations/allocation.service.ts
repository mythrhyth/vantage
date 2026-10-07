import { portfolioService } from '../portfolios/portfolio.service';

export class AllocationService {
  async simulateAllocation(portfolioId: string, sensitivity: number, maxWeight: number, maxChange: number) {
    const assets = await portfolioService.getPortfolioAssets(portfolioId);
    const equities = assets.filter(a => a.assetType === 'EQUITY');

    if (equities.length === 0) {
      return { proposed_weights: [] };
    }

    const sensMultiplier = sensitivity / 50;

    // Calculate raw proposed weights based on sentiment and sensitivity
    let rawWeights = equities.map(a => {
      const sentimentDelta = a.sentiment - a.baseSentiment;
      const change = sentimentDelta * sensMultiplier * (maxChange / 100);
      let proposed = a.currentWeight + change;
      
      // Cap at maxWeight
      if (proposed > maxWeight / 100) proposed = maxWeight / 100;
      if (proposed < 0) proposed = 0;
      
      return {
        id: a.id,
        ticker: a.ticker,
        company: a.company,
        sector: a.sector,
        currentWeight: a.currentWeight,
        proposedWeight: proposed,
        sentiment: a.sentiment
      };
    });

    // Normalize proposed weights so they sum to total equity current weight sum
    const totalCurrentWeight = equities.reduce((sum, a) => sum + a.currentWeight, 0);
    const totalProposedRaw = rawWeights.reduce((sum, r) => sum + r.proposedWeight, 0);

    const normalizedWeights = rawWeights.map(r => ({
      ...r,
      proposedWeight: totalProposedRaw > 0 ? (r.proposedWeight / totalProposedRaw) * totalCurrentWeight : r.currentWeight
    }));

    return {
      proposed_weights: normalizedWeights
    };
  }
}

export const allocationService = new AllocationService();
