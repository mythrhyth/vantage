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
      const change = sentimentDelta * sensMultiplier * maxChange;
      let proposed = a.currentWeight + change;
      
      // Cap at maxWeight
      const maxWVal = maxWeight > 1 ? maxWeight : maxWeight * 100;
      if (proposed > maxWVal) proposed = maxWVal;
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

    const normalizedWeights = rawWeights.map(r => {
      const finalWeight = totalProposedRaw > 0 ? (r.proposedWeight / totalProposedRaw) * totalCurrentWeight : r.currentWeight;
      return {
        ...r,
        proposedWeight: parseFloat(finalWeight.toFixed(2)),
        proposed_weight: parseFloat(finalWeight.toFixed(2)),
        proposedPct: parseFloat(finalWeight.toFixed(2))
      };
    });

    return {
      proposed_weights: normalizedWeights,
      proposedWeights: normalizedWeights
    };
  }
}

export const allocationService = new AllocationService();
