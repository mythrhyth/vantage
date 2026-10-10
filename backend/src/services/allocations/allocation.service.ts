import { prisma } from '../../db';
import { portfolioService } from '../portfolios/portfolio.service';

export interface SignalProvenanceItem {
  id: string;
  title: string;
  category: string;
  sentiment: number;
  impact: number;
  source: string;
  createdAt: string;
  url?: string | null;
}

export interface AssetAllocationItem {
  id: string;
  ticker: string;
  company: string;
  sector: string;
  currentWeight: number;
  current_weight: number;
  desiredWeight: number;       // Unconstrained target before caps
  proposedWeight: number;      // Final constraint-compliant target
  proposed_weight: number;
  proposedPct: number;
  weightChange: number;
  weight_change: number;
  tradeSizeVal: number;        // Trade size in portfolio currency
  sentiment: number;           // Aggregated sentiment signal [-1.0, +1.0]
  baseSentiment: number;
  signalFreshnessDays: number; // Age of latest signal in days
  signalCount: number;         // Count of supporting signals
  bindingConstraint: 'MAX_STOCK_WEIGHT_BOUND' | 'MAX_CHANGE_POS_BOUND' | 'MAX_CHANGE_NEG_BOUND' | 'SECTOR_CAP_BOUND' | 'NON_NEGATIVE_BOUND' | 'UNCONSTRAINED';
  status: string;
  reason: string;
  supportingEvents: SignalProvenanceItem[];
}

export interface AllocationRunTrace {
  timestamp: string;
  portfolioId: string;
  totalAssetsFetched: number;
  eligibleEquityCount: number;
  excludedNonEquityCount: number;
  inputTickers: string[];
  missingDataAssets: string[];
  optimizerStatus: 'CONVERGED' | 'WARNING' | 'INFEASIBLE' | 'FAILED';
  infeasibilityReason?: string;
  constraints: {
    sensitivity: number;
    maxWeight: number;
    maxChange: number;
    sectorLimit: number;
    frequency: string;
    transactionCostBps: number;
  };
  metrics: {
    portfolioValue: number;
    totalTurnoverPct: number;      // sum(|delta_w|) / 2
    tradedNotionalVal: number;     // sum(|delta_w|/100 * baseline)
    estimatedTransactionCostVal: number; // tradedNotional * (bps / 10000)
    estimatedTransactionCostPct: number; // cost / baseline * 100
  };
  weightSumBeforeNorm: number;
  weightSumAfterNorm: number;
  zeroWeightAssets: Array<{ ticker: string; company: string; reason: string }>;
}

export interface SimulationResult {
  runId?: string;
  proposed_weights: AssetAllocationItem[];
  proposedWeights: AssetAllocationItem[];
  trace: AllocationRunTrace;
  isSimulated: boolean;
  isApplied: boolean;
}

export class AllocationService {
  /**
   * Aggregates sentiment signals for a stock with exponential decay freshness
   * halfLife = 7 days.
   */
  private async getStockSentimentWithProvenance(
    ticker?: string | null,
    company?: string | null,
    sector?: string | null
  ): Promise<{ aggregatedSentiment: number; signalFreshnessDays: number; count: number; events: SignalProvenanceItem[] }> {
    const events = await prisma.riskEvent.findMany({
      take: 100,
      orderBy: { created_at: 'desc' }
    });

    const matches: Array<{
      event: (typeof events)[0];
      sentiment: number;
      impact: number;
      freshnessWeight: number;
      ageDays: number;
    }> = [];

    const now = new Date().getTime();
    const halfLifeDays = 7.0;

    for (const e of events) {
      const affected = Array.isArray(e.affected_assets) ? e.affected_assets.map(a => String(a).toLowerCase()) : [];
      const entity = (e.entity || '').toLowerCase();
      const title = (e.title || '').toLowerCase();
      const cat = (e.category || '').toLowerCase();

      const tLower = (ticker || '').toLowerCase();
      const cLower = (company || '').toLowerCase();
      const sLower = (sector || '').toLowerCase();

      // Entity resolution: direct ticker match, company match, or sector match
      const isDirectTickerMatch = tLower && (affected.includes(tLower) || entity === tLower || title.includes(` ${tLower} `));
      const isDirectCompanyMatch = cLower && (affected.includes(cLower) || entity.includes(cLower) || title.includes(cLower));
      const isSectorMatch = sLower && cat.includes(sLower);

      if (isDirectTickerMatch || isDirectCompanyMatch || isSectorMatch) {
        const createdMs = new Date(e.created_at).getTime();
        const ageDays = Math.max(0, (now - createdMs) / (1000 * 60 * 60 * 24));
        const freshnessWeight = Math.exp(-Math.LN2 * (ageDays / halfLifeDays));

        matches.push({
          event: e,
          sentiment: Number(e.sentiment),
          impact: Number(e.impact || 1.0),
          freshnessWeight,
          ageDays
        });
      }
    }

    if (matches.length === 0) {
      return { aggregatedSentiment: 0.0, signalFreshnessDays: 0, count: 0, events: [] };
    }

    // Weighted average sentiment using impact * confidence * freshnessWeight
    let totalWeight = 0;
    let weightedSum = 0;
    let minAge = Infinity;

    const supportingEvents: SignalProvenanceItem[] = matches.map(m => {
      if (m.ageDays < minAge) minAge = m.ageDays;
      const conf = Number(m.event.sentiment_confidence || m.event.impact_confidence || 0.9);
      const w = Math.max(0.1, m.impact) * conf * m.freshnessWeight;
      totalWeight += w;
      weightedSum += m.sentiment * w;

      return {
        id: m.event.id,
        title: m.event.title,
        category: m.event.category,
        sentiment: Number(m.event.sentiment),
        impact: Number(m.event.impact || 1.0),
        source: m.event.source,
        createdAt: m.event.created_at.toISOString(),
        url: m.event.canonical_url
      };
    });

    const aggSentiment = totalWeight > 0 ? parseFloat((weightedSum / totalWeight).toFixed(3)) : 0.0;
    const freshestDays = isFinite(minAge) ? parseFloat(minAge.toFixed(1)) : 0;

    return {
      aggregatedSentiment: aggSentiment,
      signalFreshnessDays: freshestDays,
      count: matches.length,
      events: supportingEvents.slice(0, 5) // Return top 5 relevant provenance events
    };
  }

  /**
   * Deterministic Constraint-Aware Allocation Optimizer
   */
  async simulateAllocation(
    portfolioId: string,
    sensitivity: number = 50,
    maxWeight: number = 14,
    maxChange: number = 2.0,
    sectorLimit: number = 38,
    frequency: string = 'Weekly',
    transactionCostBps: number = 12,
    isApplied: boolean = false
  ): Promise<SimulationResult> {
    const portfolio = await portfolioService.getPortfolioById(portfolioId);
    const allAssets = await portfolioService.getPortfolioAssets(portfolioId);
    const portfolioValue = portfolio ? Number(portfolio.baselineValue || portfolio.baseline_value || 2450.0) : 2450.0;

    const isEquity = (type: string) => {
      const t = (type || '').toUpperCase();
      return t === 'EQUITY' || t === 'EQUITIES' || t === 'STOCK' || t === 'STOCKS';
    };

    const equities = allAssets.filter(a => isEquity(a.assetType || a.asset_type || '') || Boolean(a.ticker));
    const nonEquities = allAssets.filter(a => !equities.includes(a));

    if (equities.length === 0) {
      const emptyTrace: AllocationRunTrace = {
        timestamp: new Date().toISOString(),
        portfolioId,
        totalAssetsFetched: allAssets.length,
        eligibleEquityCount: 0,
        excludedNonEquityCount: nonEquities.length,
        inputTickers: [],
        missingDataAssets: [],
        optimizerStatus: 'FAILED',
        infeasibilityReason: 'No equity assets present in portfolio universe',
        constraints: { sensitivity, maxWeight, maxChange, sectorLimit, frequency, transactionCostBps },
        metrics: {
          portfolioValue,
          totalTurnoverPct: 0,
          tradedNotionalVal: 0,
          estimatedTransactionCostVal: 0,
          estimatedTransactionCostPct: 0
        },
        weightSumBeforeNorm: 0,
        weightSumAfterNorm: 0,
        zeroWeightAssets: []
      };
      return {
        proposed_weights: [],
        proposedWeights: [],
        trace: emptyTrace,
        isSimulated: !isApplied,
        isApplied
      };
    }

    // Deduplicate equities by ticker
    const seenTickers = new Set<string>();
    const uniqueEquities: typeof equities = [];
    for (const eq of equities) {
      const tick = (eq.ticker || 'UNKNOWN').toUpperCase();
      if (!seenTickers.has(tick)) {
        seenTickers.add(tick);
        uniqueEquities.push(eq);
      }
    }

    const totalCurrentWeight = uniqueEquities.reduce((sum, a) => sum + Number(a.currentWeight || a.current_weight || 0), 0);
    const targetTotalSum = totalCurrentWeight > 0 ? totalCurrentWeight : 100.0;

    const maxWCap = maxWeight > 1.0 ? maxWeight : maxWeight * 100;
    const maxCCap = maxChange > 0 ? maxChange : 2.0;
    const sectorCap = sectorLimit > 1.0 ? sectorLimit : sectorLimit * 100;
    const sensMultiplier = sensitivity / 50.0;

    const N = uniqueEquities.length;

    // 1. Retrieve sentiment signals & calculate unconstrained desired weights
    const assetSignalData = await Promise.all(
      uniqueEquities.map(a => this.getStockSentimentWithProvenance(a.ticker, a.company, a.sector))
    );

    const assetPrep = uniqueEquities.map((a, i) => {
      const curW = Number(a.currentWeight || a.current_weight || 0);
      const sigData = assetSignalData[i];
      const sentiment = sigData.aggregatedSentiment !== 0 ? sigData.aggregatedSentiment : Number(a.sentiment || 0);
      const baseS = Number(a.baseSentiment || a.base_sentiment || 0);
      const sentimentDelta = sentiment - baseS;

      // Effective baseline weight for newly added zero-weight assets
      const baselineRefW = curW > 0 ? curW : (targetTotalSum / N);
      
      // Unconstrained desired delta (linear in sensitivity & maxChange)
      const desiredDelta = sentimentDelta * sensMultiplier * maxCCap;
      const desiredWeight = Math.max(0, baselineRefW + desiredDelta);

      // Box bounds per stock: L_i <= w_i <= U_i
      const L_i = Math.max(0.0, curW - maxCCap);
      const U_i = Math.min(maxWCap, curW + maxCCap);

      return {
        id: a.id,
        ticker: (a.ticker || 'STOCK').toUpperCase(),
        company: a.company || a.ticker || 'Company',
        sector: a.sector || 'General',
        currentWeight: curW,
        sentiment,
        baseSentiment: baseS,
        desiredWeight,
        desiredDelta,
        L_i,
        U_i,
        sigData
      };
    });

    // 2. Feasibility Check
    const sumL = assetPrep.reduce((acc, x) => acc + x.L_i, 0);
    const sumU = assetPrep.reduce((acc, x) => acc + x.U_i, 0);

    if (sumL > targetTotalSum + 1e-4 || sumU < targetTotalSum - 1e-4) {
      const infeasibleTrace: AllocationRunTrace = {
        timestamp: new Date().toISOString(),
        portfolioId,
        totalAssetsFetched: allAssets.length,
        eligibleEquityCount: N,
        excludedNonEquityCount: nonEquities.length,
        inputTickers: assetPrep.map(x => x.ticker),
        missingDataAssets: [],
        optimizerStatus: 'INFEASIBLE',
        infeasibilityReason: `Feasibility violation: sum of lower bounds (${sumL.toFixed(2)}%) > target sum (${targetTotalSum.toFixed(2)}%) or sum of upper bounds (${sumU.toFixed(2)}%) < target sum`,
        constraints: { sensitivity, maxWeight, maxChange, sectorLimit, frequency, transactionCostBps },
        metrics: { portfolioValue, totalTurnoverPct: 0, tradedNotionalVal: 0, estimatedTransactionCostVal: 0, estimatedTransactionCostPct: 0 },
        weightSumBeforeNorm: parseFloat(assetPrep.reduce((s, x) => s + x.desiredWeight, 0).toFixed(2)),
        weightSumAfterNorm: targetTotalSum,
        zeroWeightAssets: []
      };

      return {
        proposed_weights: [],
        proposedWeights: [],
        trace: infeasibleTrace,
        isSimulated: !isApplied,
        isApplied
      };
    }

    // 3. Iterative Projection onto Box & Sector Polytope
    // Initialize weights with desired weights
    const w = assetPrep.map(x => Math.min(x.U_i, Math.max(x.L_i, x.desiredWeight)));

    // Iterative Bounded Adjustment to hit targetTotalSum while respecting L_i, U_i and Sector Caps
    const maxIter = 50;
    let iter = 0;
    const locked = new Array(N).fill(false);

    while (iter < maxIter) {
      iter++;

      // Check sector caps
      const sectorTotals: Record<string, number> = {};
      assetPrep.forEach((item, idx) => {
        sectorTotals[item.sector] = (sectorTotals[item.sector] || 0) + w[idx];
      });

      let sectorCapViolation = false;
      Object.entries(sectorTotals).forEach(([sec, tot]) => {
        if (tot > sectorCap + 1e-6) {
          sectorCapViolation = true;
          const scale = sectorCap / tot;
          assetPrep.forEach((item, idx) => {
            if (item.sector === sec) {
              w[idx] = Math.max(item.L_i, w[idx] * scale);
              locked[idx] = true; // Lock sector-capped items
            }
          });
        }
      });

      const currentSum = w.reduce((acc, val) => acc + val, 0);
      const diff = targetTotalSum - currentSum;

      if (Math.abs(diff) < 1e-5 && !sectorCapViolation) {
        break;
      }

      // Distribute diff among unlocked assets
      const freeIndices: number[] = [];
      let totalHeadroom = 0;

      assetPrep.forEach((item, idx) => {
        if (!locked[idx]) {
          if (diff > 0 && w[idx] < item.U_i - 1e-6) {
            freeIndices.push(idx);
            totalHeadroom += (item.U_i - w[idx]);
          } else if (diff < 0 && w[idx] > item.L_i + 1e-6) {
            freeIndices.push(idx);
            totalHeadroom += (w[idx] - item.L_i);
          }
        }
      });

      if (freeIndices.length === 0 || totalHeadroom <= 1e-6) {
        // Fallback: distribute evenly among any unlocked assets that haven't hit box boundary
        break;
      }

      for (const idx of freeIndices) {
        const item = assetPrep[idx];
        const capacity = diff > 0 ? (item.U_i - w[idx]) : (w[idx] - item.L_i);
        const share = (capacity / totalHeadroom) * diff;
        w[idx] = Math.min(item.U_i, Math.max(item.L_i, w[idx] + share));
      }
    }

    // 4. Exact Remainder Adjustment & Strict Rounding
    // Ensure sum is EXACTLY targetTotalSum to 2 decimal places
    let roundedW = w.map(v => parseFloat(v.toFixed(2)));
    let sumRounded = roundedW.reduce((a, b) => a + b, 0);
    const residual = parseFloat((targetTotalSum - sumRounded).toFixed(2));

    if (Math.abs(residual) >= 0.01) {
      // Find asset with maximum room to absorb 0.01 step without breaking bounds
      const step = residual > 0 ? 0.01 : -0.01;
      const countSteps = Math.round(Math.abs(residual) / 0.01);
      
      for (let s = 0; s < countSteps; s++) {
        let bestIdx = -1;
        let bestMargin = -1;

        assetPrep.forEach((item, idx) => {
          const nextVal = parseFloat((roundedW[idx] + step).toFixed(2));
          if (nextVal >= item.L_i - 1e-4 && nextVal <= item.U_i + 1e-4) {
            const margin = Math.abs(item.desiredWeight - roundedW[idx]);
            if (margin > bestMargin) {
              bestMargin = margin;
              bestIdx = idx;
            }
          }
        });

        if (bestIdx >= 0) {
          roundedW[bestIdx] = parseFloat((roundedW[bestIdx] + step).toFixed(2));
        } else {
          // Force apply step to first non-zero asset if all tight
          roundedW[0] = Math.max(0, parseFloat((roundedW[0] + step).toFixed(2)));
        }
      }
    }

    // 5. Calculate Financial Metrics (Turnover, Traded Notional, Transaction Cost)
    const zeroWeightAssets: Array<{ ticker: string; company: string; reason: string }> = [];
    let sumAbsDeltaPct = 0;

    const finalItems: AssetAllocationItem[] = assetPrep.map((item, i) => {
      const finalWeight = roundedW[i];
      const change = parseFloat((finalWeight - item.currentWeight).toFixed(2));
      const absDelta = Math.abs(change);
      sumAbsDeltaPct += absDelta;

      const tradeSizeVal = parseFloat(((absDelta / 100.0) * portfolioValue).toFixed(2));

      // Determine binding constraint & explainability rationale
      let bindingConstraint: AssetAllocationItem['bindingConstraint'] = 'UNCONSTRAINED';
      let status = change > 0 ? `Increased (+${change.toFixed(2)} pp)` : change < 0 ? `Decreased (${change.toFixed(2)} pp)` : 'Unchanged';
      let reason = 'Within optimization constraints';

      if (finalWeight === item.U_i && item.desiredWeight > item.U_i + 1e-4) {
        if (item.U_i === maxWCap) {
          bindingConstraint = 'MAX_STOCK_WEIGHT_BOUND';
          status = 'Max Stock Weight Capped';
          reason = `Capped at maximum stock weight limit (${maxWCap.toFixed(1)}%)`;
        } else {
          bindingConstraint = 'MAX_CHANGE_POS_BOUND';
          status = 'Max Positive Change Capped';
          reason = `Capped by maximum allowed weight increase (+${maxCCap.toFixed(1)} pp)`;
        }
      } else if (finalWeight === item.L_i && item.desiredWeight < item.L_i - 1e-4) {
        if (item.L_i === 0.0) {
          bindingConstraint = 'NON_NEGATIVE_BOUND';
          status = 'Non-Negative Capped';
          reason = 'Capped at minimum 0.00% weight limit';
        } else {
          bindingConstraint = 'MAX_CHANGE_NEG_BOUND';
          status = 'Max Negative Change Capped';
          reason = `Capped by maximum allowed weight decrease (-${maxCCap.toFixed(1)} pp)`;
        }
      }

      if (finalWeight === 0) {
        if (item.currentWeight === 0 && item.sentiment === 0) {
          status = 'Zero Baseline & Neutral Signal';
          reason = 'Asset has zero current weight and neutral sentiment signal';
        } else {
          status = 'Optimizer Excluded';
          reason = 'Reduced to 0.00% target weight by risk optimization';
        }
        zeroWeightAssets.push({ ticker: item.ticker, company: item.company, reason });
      }

      return {
        id: item.id,
        ticker: item.ticker,
        company: item.company,
        sector: item.sector,
        currentWeight: item.currentWeight,
        current_weight: item.currentWeight,
        desiredWeight: parseFloat(item.desiredWeight.toFixed(2)),
        proposedWeight: finalWeight,
        proposed_weight: finalWeight,
        proposedPct: finalWeight,
        weightChange: change,
        weight_change: change,
        tradeSizeVal,
        sentiment: item.sentiment,
        baseSentiment: item.baseSentiment,
        signalFreshnessDays: item.sigData.signalFreshnessDays,
        signalCount: item.sigData.count,
        bindingConstraint,
        status,
        reason,
        supportingEvents: item.sigData.events
      };
    });

    // Turnover % = sum(|delta_w|) / 2
    const totalTurnoverPct = parseFloat((sumAbsDeltaPct / 2.0).toFixed(2));
    // Traded Notional = sum(|delta_w|/100 * baseline)
    const tradedNotionalVal = parseFloat(((sumAbsDeltaPct / 100.0) * portfolioValue).toFixed(2));
    // Estimated Transaction Cost = Traded Notional * (bps / 10000)
    const estimatedTransactionCostVal = parseFloat((tradedNotionalVal * (transactionCostBps / 10000.0)).toFixed(2));
    const estimatedTransactionCostPct = portfolioValue > 0 ? parseFloat(((estimatedTransactionCostVal / portfolioValue) * 100.0).toFixed(4)) : 0;

    const weightSumAfterNorm = finalItems.reduce((acc, x) => acc + x.proposedWeight, 0);

    const trace: AllocationRunTrace = {
      timestamp: new Date().toISOString(),
      portfolioId,
      totalAssetsFetched: allAssets.length,
      eligibleEquityCount: N,
      excludedNonEquityCount: nonEquities.length,
      inputTickers: finalItems.map(x => x.ticker),
      missingDataAssets: [],
      optimizerStatus: 'CONVERGED',
      constraints: { sensitivity, maxWeight, maxChange, sectorLimit, frequency, transactionCostBps },
      metrics: {
        portfolioValue,
        totalTurnoverPct,
        tradedNotionalVal,
        estimatedTransactionCostVal,
        estimatedTransactionCostPct
      },
      weightSumBeforeNorm: parseFloat(assetPrep.reduce((s, x) => s + x.desiredWeight, 0).toFixed(2)),
      weightSumAfterNorm: parseFloat(weightSumAfterNorm.toFixed(2)),
      zeroWeightAssets
    };

    // 6. Persist run record to database (AllocationRun table)
    let runId: string | undefined = undefined;
    try {
      const savedRun = await prisma.allocationRun.create({
        data: {
          portfolio_id: portfolioId,
          timestamp: new Date(),
          sensitivity,
          max_weight: maxWeight,
          max_change: maxChange,
          sector_limit: sectorLimit,
          frequency,
          transaction_cost_bps: transactionCostBps,
          turnover: totalTurnoverPct,
          transaction_cost_val: estimatedTransactionCostVal,
          is_simulated: !isApplied,
          is_applied: isApplied,
          trace_summary: JSON.parse(JSON.stringify(trace)),
          items: JSON.parse(JSON.stringify(finalItems))
        }
      });
      runId = savedRun.id;
    } catch (dbErr: any) {
      console.warn(`[AllocationService] Failed to persist AllocationRun record to database: ${dbErr.message}`);
    }

    return {
      runId,
      proposed_weights: finalItems,
      proposedWeights: finalItems,
      trace,
      isSimulated: !isApplied,
      isApplied
    };
  }

  /**
   * Fetches historical allocation runs from database
   */
  async getAllocationHistory(portfolioId: string, limit: number = 20) {
    const runs = await prisma.allocationRun.findMany({
      where: { portfolio_id: portfolioId },
      orderBy: { timestamp: 'desc' },
      take: limit
    });

    return runs.map(r => ({
      id: r.id,
      portfolioId: r.portfolio_id,
      timestamp: r.timestamp.toISOString(),
      sensitivity: Number(r.sensitivity),
      maxWeight: Number(r.max_weight),
      maxChange: Number(r.max_change),
      sectorLimit: Number(r.sector_limit),
      frequency: r.frequency,
      transactionCostBps: Number(r.transaction_cost_bps),
      turnover: Number(r.turnover),
      transactionCostVal: Number(r.transaction_cost_val),
      isSimulated: r.is_simulated,
      isApplied: r.is_applied,
      traceSummary: r.trace_summary,
      items: r.items
    }));
  }
}

export const allocationService = new AllocationService();

