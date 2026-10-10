import { portfolioService } from '../portfolios/portfolio.service';

export class AllocationService {
  async simulateAllocation(
    portfolioId: string,
    sensitivity: number = 50,
    maxWeight: number = 14,
    maxChange: number = 2.0,
    sectorLimit: number = 40
  ) {
    const assets = await portfolioService.getPortfolioAssets(portfolioId);
    
    const isEquity = (type: string) => {
      const t = (type || '').toUpperCase();
      return t === 'EQUITY' || t === 'EQUITIES' || t === 'STOCK' || t === 'STOCKS';
    };

    const equities = assets.filter(a => isEquity(a.assetType || a.asset_type || '') || Boolean(a.ticker));

    if (equities.length === 0) {
      return { proposed_weights: [], proposedWeights: [] };
    }

    const totalCurrentWeight = equities.reduce((sum, a) => sum + Number(a.currentWeight || a.current_weight || 0), 0);
    const sensMultiplier = sensitivity / 50;
    const maxWCap = maxWeight > 1.0 ? maxWeight : maxWeight * 100;
    const maxCCap = maxChange > 0 ? maxChange : 2.0;
    const sectorCap = sectorLimit > 1.0 ? sectorLimit : sectorLimit * 100;

    // 1. Initial sentiment-driven delta calculation capped by maxChange
    const items = equities.map(a => {
      const curW = Number(a.currentWeight || a.current_weight || 0);
      const s = Number(a.sentiment || 0);
      const baseS = Number(a.baseSentiment || a.base_sentiment || 0);
      const sentimentDelta = s - baseS;

      // Raw desired change
      let rawDelta = sentimentDelta * sensMultiplier * 1.5;
      
      // Enforce maxChange constraint
      if (rawDelta > maxCCap) rawDelta = maxCCap;
      if (rawDelta < -maxCCap) rawDelta = -maxCCap;

      let targetW = curW + rawDelta;
      if (targetW > maxWCap) targetW = maxWCap;
      if (targetW < 0) targetW = 0;

      return {
        id: a.id,
        ticker: a.ticker || 'STOCK',
        company: a.company || a.ticker || 'Company',
        sector: a.sector || 'General',
        currentWeight: curW,
        proposedWeight: targetW,
        sentiment: s
      };
    });

    // 2. Normalize to sum equal to totalCurrentWeight
    const rawSum = items.reduce((acc, item) => acc + item.proposedWeight, 0);
    if (rawSum > 0) {
      items.forEach(item => {
        item.proposedWeight = (item.proposedWeight / rawSum) * totalCurrentWeight;
      });
    }

    // 3. Enforce hard constraints (maxWeight, maxChange from curW, non-negativity)
    items.forEach(item => {
      let w = item.proposedWeight;
      if (w > maxWCap) w = maxWCap;
      if (w < 0) w = 0;

      const delta = w - item.currentWeight;
      if (delta > maxCCap) w = item.currentWeight + maxCCap;
      if (delta < -maxCCap) w = Math.max(0, item.currentWeight - maxCCap);

      item.proposedWeight = w;
    });

    // 4. Sector exposure limit check and adjustment
    const sectorTotals: Record<string, number> = {};
    items.forEach(item => {
      sectorTotals[item.sector] = (sectorTotals[item.sector] || 0) + item.proposedWeight;
    });

    Object.keys(sectorTotals).forEach(sector => {
      if (sectorTotals[sector] > sectorCap) {
        const factor = sectorCap / sectorTotals[sector];
        items.forEach(item => {
          if (item.sector === sector) {
            item.proposedWeight = item.proposedWeight * factor;
          }
        });
      }
    });

    // 5. Final normalization & rounding to ensure exact precision
    const finalSum = items.reduce((acc, item) => acc + item.proposedWeight, 0);
    const finalNormalized = items.map(item => {
      const finalWeight = finalSum > 0 ? (item.proposedWeight / finalSum) * totalCurrentWeight : item.currentWeight;
      const rounded = parseFloat(finalWeight.toFixed(2));
      return {
        ...item,
        proposedWeight: rounded,
        proposed_weight: rounded,
        proposedPct: rounded
      };
    });

    return {
      proposed_weights: finalNormalized,
      proposedWeights: finalNormalized
    };
  }
}

export const allocationService = new AllocationService();
