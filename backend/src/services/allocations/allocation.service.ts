import { portfolioService } from '../portfolios/portfolio.service';

export interface AssetAllocationItem {
  id: string;
  ticker: string;
  company: string;
  sector: string;
  currentWeight: number;
  current_weight: number;
  proposedWeight: number;
  proposed_weight: number;
  proposedPct: number;
  weightChange: number;
  weight_change: number;
  sentiment: number;
  baseSentiment: number;
  status: string;
  reason: string;
}

export interface AllocationRunTrace {
  timestamp: string;
  portfolioId: string;
  totalAssetsFetched: number;
  eligibleEquityCount: number;
  excludedNonEquityCount: number;
  inputTickers: string[];
  missingDataAssets: string[];
  optimizerStatus: 'CONVERGED' | 'WARNING' | 'FAILED';
  constraints: {
    sensitivity: number;
    maxWeight: number;
    maxChange: number;
    sectorLimit: number;
  };
  weightSumBeforeNorm: number;
  weightSumAfterNorm: number;
  zeroWeightAssets: Array<{ ticker: string; company: string; reason: string }>;
}

export class AllocationService {
  async simulateAllocation(
    portfolioId: string,
    sensitivity: number = 50,
    maxWeight: number = 14,
    maxChange: number = 2.0,
    sectorLimit: number = 40
  ) {
    const allAssets = await portfolioService.getPortfolioAssets(portfolioId);
    
    const isEquity = (type: string) => {
      const t = (type || '').toUpperCase();
      return t === 'EQUITY' || t === 'EQUITIES' || t === 'STOCK' || t === 'STOCKS';
    };

    // Filter equity universe for index allocation
    const equities = allAssets.filter(a => isEquity(a.assetType || a.asset_type || '') || Boolean(a.ticker));
    const nonEquities = allAssets.filter(a => !equities.includes(a));

    if (equities.length === 0) {
      return {
        proposed_weights: [],
        proposedWeights: [],
        trace: {
          timestamp: new Date().toISOString(),
          portfolioId,
          totalAssetsFetched: allAssets.length,
          eligibleEquityCount: 0,
          excludedNonEquityCount: nonEquities.length,
          inputTickers: [],
          missingDataAssets: [],
          optimizerStatus: 'FAILED',
          constraints: { sensitivity, maxWeight, maxChange, sectorLimit },
          weightSumBeforeNorm: 0,
          weightSumAfterNorm: 0,
          zeroWeightAssets: []
        }
      };
    }

    // Check for duplicate tickers / IDs and handle explicitly
    const seenTickers = new Set<string>();
    const uniqueEquities: typeof equities = [];
    const duplicateTickers: string[] = [];

    for (const eq of equities) {
      const tick = (eq.ticker || 'UNKNOWN').toUpperCase();
      if (seenTickers.has(tick)) {
        duplicateTickers.push(tick);
      } else {
        seenTickers.add(tick);
        uniqueEquities.push(eq);
      }
    }

    const totalCurrentWeight = uniqueEquities.reduce((sum, a) => sum + Number(a.currentWeight || a.current_weight || 0), 0);
    // If current weights total 0 (e.g. brand new portfolio with 0 weights), benchmark target is equal distribution
    const targetTotalSum = totalCurrentWeight > 0 ? totalCurrentWeight : 100.0;

    const sensMultiplier = sensitivity / 50;
    const maxWCap = maxWeight > 1.0 ? maxWeight : maxWeight * 100;
    const maxCCap = maxChange > 0 ? maxChange : 2.0;
    const sectorCap = sectorLimit > 1.0 ? sectorLimit : sectorLimit * 100;

    const missingDataAssets: string[] = [];

    // 1. Initial sentiment-driven delta calculation capped by maxChange
    const items = uniqueEquities.map(a => {
      const curW = Number(a.currentWeight || a.current_weight || 0);
      const s = Number(a.sentiment || 0);
      const baseS = Number(a.baseSentiment || a.base_sentiment || 0);
      const sentimentDelta = s - baseS;

      if (a.sentiment === undefined || a.sentiment === null || isNaN(s)) {
        missingDataAssets.push(a.ticker || 'UNKNOWN');
      }

      // If asset current weight is 0, give it fair baseline opportunity if sentiment signal exists
      const effectiveBaseW = curW > 0 ? curW : (sentimentDelta > 0 ? targetTotalSum / uniqueEquities.length : 0);

      // Raw desired change
      let rawDelta = sentimentDelta * sensMultiplier * 1.5;
      
      // Enforce maxChange constraint
      if (rawDelta > maxCCap) rawDelta = maxCCap;
      if (rawDelta < -maxCCap) rawDelta = -maxCCap;

      let targetW = effectiveBaseW + rawDelta;
      if (targetW > maxWCap) targetW = maxWCap;
      if (targetW < 0) targetW = 0;

      return {
        id: a.id,
        ticker: (a.ticker || 'STOCK').toUpperCase(),
        company: a.company || a.ticker || 'Company',
        sector: a.sector || 'General',
        currentWeight: curW,
        proposedWeight: targetW,
        sentiment: s,
        baseSentiment: baseS,
        status: 'Optimized',
        reason: 'Within optimization constraints'
      };
    });

    // 2. Normalize to sum equal to targetTotalSum
    const rawSum = items.reduce((acc, item) => acc + item.proposedWeight, 0);
    if (rawSum > 0) {
      items.forEach(item => {
        item.proposedWeight = (item.proposedWeight / rawSum) * targetTotalSum;
      });
    } else {
      // Equal distribution fallback if raw sum is 0
      const equalW = targetTotalSum / items.length;
      items.forEach(item => {
        item.proposedWeight = equalW;
      });
    }

    // 3. Enforce hard constraints (maxWeight, maxChange from curW, non-negativity)
    items.forEach(item => {
      let w = item.proposedWeight;
      let status = 'Optimized';
      let reason = 'Within optimization constraints';

      if (w > maxWCap) {
        w = maxWCap;
        status = 'Max Weight Capped';
        reason = `Capped at max weight limit (${maxWCap.toFixed(1)}%)`;
      }
      if (w < 0) {
        w = 0;
        status = 'Non-Negative Capped';
        reason = 'Capped at 0% minimum weight';
      }

      const delta = w - item.currentWeight;
      if (delta > maxCCap) {
        w = item.currentWeight + maxCCap;
        status = 'Max Change Capped';
        reason = `Capped by max positive change (+${maxCCap.toFixed(1)} pp)`;
      } else if (delta < -maxCCap) {
        w = Math.max(0, item.currentWeight - maxCCap);
        status = 'Max Change Capped';
        reason = `Capped by max negative change (-${maxCCap.toFixed(1)} pp)`;
      }

      item.proposedWeight = w;
      item.status = status;
      item.reason = reason;
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
            item.status = 'Sector Capped';
            item.reason = `Scaled down due to sector limit (${sector} ${sectorCap.toFixed(1)}%)`;
          }
        });
      }
    });

    // 5. Final normalization & rounding to ensure exact precision and target sum
    const finalSum = items.reduce((acc, item) => acc + item.proposedWeight, 0);
    const zeroWeightAssets: Array<{ ticker: string; company: string; reason: string }> = [];

    const finalNormalized: AssetAllocationItem[] = items.map(item => {
      const finalWeight = finalSum > 0 ? (item.proposedWeight / finalSum) * targetTotalSum : item.currentWeight;
      const rounded = parseFloat(finalWeight.toFixed(2));
      const change = parseFloat((rounded - item.currentWeight).toFixed(2));

      let finalStatus = item.status;
      let finalReason = item.reason;

      if (rounded === 0) {
        if (item.currentWeight === 0 && item.sentiment === 0) {
          finalStatus = 'Zero Baseline & Sentiment';
          finalReason = 'Asset has zero current weight and neutral sentiment signal';
        } else if (item.currentWeight === 0) {
          finalStatus = 'Newly Added · Zero Weight';
          finalReason = 'Newly added asset with zero baseline weight';
        } else {
          finalStatus = 'Optimizer Excluded';
          finalReason = 'Reduced to 0.00% target weight by risk optimization';
        }
        zeroWeightAssets.push({
          ticker: item.ticker,
          company: item.company,
          reason: finalReason
        });
      } else if (finalStatus === 'Optimized') {
        finalStatus = change > 0 ? `Increased (+${change.toFixed(2)} pp)` : change < 0 ? `Decreased (${change.toFixed(2)} pp)` : 'Unchanged';
      }

      return {
        id: item.id,
        ticker: item.ticker,
        company: item.company,
        sector: item.sector,
        currentWeight: item.currentWeight,
        current_weight: item.currentWeight,
        proposedWeight: rounded,
        proposed_weight: rounded,
        proposedPct: rounded,
        weightChange: change,
        weight_change: change,
        sentiment: item.sentiment,
        baseSentiment: item.baseSentiment,
        status: finalStatus,
        reason: finalReason
      };
    });

    const weightSumAfterNorm = finalNormalized.reduce((sum, item) => sum + item.proposedWeight, 0);

    const trace: AllocationRunTrace = {
      timestamp: new Date().toISOString(),
      portfolioId,
      totalAssetsFetched: allAssets.length,
      eligibleEquityCount: uniqueEquities.length,
      excludedNonEquityCount: nonEquities.length,
      inputTickers: uniqueEquities.map(e => e.ticker || 'UNKNOWN'),
      missingDataAssets,
      optimizerStatus: 'CONVERGED',
      constraints: {
        sensitivity,
        maxWeight,
        maxChange,
        sectorLimit
      },
      weightSumBeforeNorm: parseFloat(rawSum.toFixed(2)),
      weightSumAfterNorm: parseFloat(weightSumAfterNorm.toFixed(2)),
      zeroWeightAssets
    };

    console.log(`[AllocationService] Simulated allocation run for portfolio ${portfolioId}:`, {
      eligibleAssets: uniqueEquities.length,
      nonEquityAssetsExcluded: nonEquities.length,
      duplicateTickers,
      weightSumBeforeNorm: rawSum.toFixed(2),
      weightSumAfterNorm: weightSumAfterNorm.toFixed(2),
      zeroWeightAssetsCount: zeroWeightAssets.length
    });

    return {
      proposed_weights: finalNormalized,
      proposedWeights: finalNormalized,
      trace
    };
  }
}

export const allocationService = new AllocationService();
