import { RISK_ENGINE_CONFIG } from '../../config/risk-engine.config';

export type EventCategory = 
  | 'Monetary policy'
  | 'Credit'
  | 'Macroeconomic'
  | 'Commodities'
  | 'Geopolitical'
  | 'Sector outlook'
  | 'Earnings'
  | 'Regulatory';

export type AssetClass = 'LOANS' | 'BONDS' | 'DERIVATIVES' | 'EQUITY';

export interface AssetHoldingInput {
  assetId?: string;
  ticker?: string;
  company?: string;
  assetClass: AssetClass;
  sector?: string;
  currentValue: number;
  currentWeight: number;
}

export interface PortfolioInput {
  portfolioId: string;
  baselineValue: number;
  holdings: AssetHoldingInput[];
}

export interface RiskEventInput {
  id?: string;
  title?: string;
  category: string;
  classificationConfidence?: number;
  sentiment: number;
  sentimentConfidence?: number;
  affectedAssets?: string[];
  horizon?: string;
}

export interface RelevanceInput {
  relevanceType: string; // DIRECT | INDIRECT | PORTFOLIO_WIDE | IRRELEVANT
  relevanceScore?: number;
  matchedHoldingIds?: string[];
  matchedSectors?: string[];
}

export interface DeterministicRiskOutput {
  eventSeverity: number;          // S_event ∈ [1.0, 10.0]
  severityScale: number;          // S_event / 10.0 ∈ [0.1, 1.0]
  effectiveExposure: number;      // E_effective ∈ [0.0, 1.0]
  transmissionSensitivity: number;// T_port ∈ [0.0, 1.0]
  concentration: number;          // C_conc ∈ [1.0, 1.5]
  vulnerabilityMultiplier: number;// V_port ∈ [0.0, 1.0]
  rawImpact: number;              // I_raw
  portfolioImpact: number;        // I_portfolio ∈ [1.0, 10.0]
  stressExposure: number;         // E_stress ∈ [0.0, 1.0]
  modelConfidence: number;        // C_model ∈ [0.0, 1.0]
  stressParameters: {
    rate: number;                 // bps
    spread: number;               // bps
    liquidity: number;            // %
    inflation: number;            // bps
    probability: number;          // % display telemetry
  };
  assetClassWeights: Record<string, number>;
  reconciliationWarning?: string;
}

export class DeterministicRiskEngine {
  /**
   * 1. Continuous FinBERT Sentiment Multiplier M_sent(s) = 1 - 0.35 * s
   */
  public calculateSentimentMultiplier(sentiment: number): number {
    const s = isNaN(sentiment) ? 0.0 : Math.max(-1.0, Math.min(1.0, sentiment));
    return 1.0 - (0.35 * s);
  }

  /**
   * 2. Event Severity S_event = clamp(1, 10, S_cat * M_sent)
   */
  public calculateEventSeverity(category: string, sentiment: number): number {
    const baseSev = RISK_ENGINE_CONFIG.categoryBaseSeverity[category] ?? 6.0;
    const mSent = this.calculateSentimentMultiplier(sentiment);
    const rawSev = baseSev * mSent;
    return Math.max(1.0, Math.min(10.0, rawSev));
  }

  /**
   * 3. Normalize weight to decimal [0.0, 1.0]
   */
  public normalizeWeight(weight: number): number {
    if (isNaN(weight) || !isFinite(weight) || weight < 0) return 0.0;
    return weight > 1.0 ? weight / 100.0 : weight;
  }

  /**
   * Normalize raw asset type strings from database/API to canonical AssetClass
   */
  public normalizeAssetClass(rawClass: string): AssetClass | null {
    if (!rawClass) return null;
    const upper = String(rawClass).trim().toUpperCase();
    if (upper === 'LOAN' || upper === 'LOANS') return 'LOANS';
    if (upper === 'BOND' || upper === 'BONDS') return 'BONDS';
    if (upper === 'DERIVATIVE' || upper === 'DERIVATIVES') return 'DERIVATIVES';
    if (upper === 'EQUITY' || upper === 'EQUITIES') return 'EQUITY';
    return null;
  }

  /**
   * 4. Calculate asset class exposure ratios relative to baseline
   */
  public calculateAssetClassWeights(holdings: AssetHoldingInput[], baselineValue: number): Record<string, number> {
    const weights: Record<string, number> = { LOANS: 0.0, BONDS: 0.0, DERIVATIVES: 0.0, EQUITY: 0.0 };
    if (!baselineValue || baselineValue <= 0 || !holdings || holdings.length === 0) {
      return weights;
    }

    holdings.forEach(h => {
      const cls = this.normalizeAssetClass(h.assetClass);
      if (cls && cls in weights) {
        const val = (h.currentValue !== undefined && h.currentValue !== null && h.currentValue > 0)
          ? h.currentValue
          : (this.normalizeWeight(h.currentWeight) * baselineValue);
        weights[cls] += val / baselineValue;
      }
    });

    return weights;
  }

  /**
   * 5. Portfolio Transmission Sensitivity T_port = Σ(w_A * W_cat,A)
   */
  public calculateTransmissionSensitivity(assetClassWeights: Record<string, number>, category: string): number {
    const matrix = RISK_ENGINE_CONFIG.categoryAssetMatrix[category] ?? { LOANS: 0.3, BONDS: 0.3, DERIVATIVES: 0.5, EQUITY: 0.7 };
    let tPort = 0.0;

    for (const [cls, w] of Object.entries(assetClassWeights)) {
      const sensitivity = matrix[cls] ?? 0.5;
      tPort += w * sensitivity;
    }

    return Math.max(0.0, Math.min(1.0, tPort));
  }

  /**
   * 6. Direct Exposure Ratio E_direct
   */
  public calculateDirectExposure(holdings: AssetHoldingInput[], matchedHoldingIds: string[], baselineValue: number): number {
    if (!baselineValue || baselineValue <= 0 || !matchedHoldingIds || matchedHoldingIds.length === 0 || !holdings) {
      return 0.0;
    }

    const matchedSet = new Set(matchedHoldingIds.map(id => String(id).toLowerCase()));
    let sumVal = 0.0;

    holdings.forEach(h => {
      const hId = (h.assetId || h.ticker || h.company || '').toLowerCase();
      if (matchedSet.has(hId)) {
        const val = h.currentValue !== undefined ? Math.max(0, h.currentValue) : (this.normalizeWeight(h.currentWeight) * baselineValue);
        sumVal += val;
      }
    });

    return Math.max(0.0, Math.min(1.0, sumVal / baselineValue));
  }

  /**
   * 7. Indirect Sector Exposure Ratio E_indirect
   */
  public calculateIndirectExposure(holdings: AssetHoldingInput[], matchedSectors: string[], baselineValue: number): number {
    if (!baselineValue || baselineValue <= 0 || !matchedSectors || matchedSectors.length === 0 || !holdings) {
      return 0.0;
    }

    const sectorSet = new Set(matchedSectors.map(s => String(s).toLowerCase()));
    let sumVal = 0.0;

    holdings.forEach(h => {
      const hSec = (h.sector || '').toLowerCase();
      if (sectorSet.has(hSec)) {
        const val = h.currentValue !== undefined ? Math.max(0, h.currentValue) : (this.normalizeWeight(h.currentWeight) * baselineValue);
        sumVal += val;
      }
    });

    return Math.max(0.0, Math.min(1.0, sumVal / baselineValue));
  }

  /**
   * 8. Effective Combined Exposure Ratio E_effective
   * DIRECT: E_direct
   * INDIRECT: E_indirect
   * PORTFOLIO_WIDE: 1.0
   * IRRELEVANT: 0.0
   */
  public calculateEffectiveExposure(relevanceType: string, directExp: number, indirectExp: number): number {
    const rel = (relevanceType || '').toUpperCase();
    switch (rel) {
      case 'DIRECT':
        return Math.max(0.0, Math.min(1.0, directExp));
      case 'INDIRECT':
        return Math.max(0.0, Math.min(1.0, indirectExp));
      case 'PORTFOLIO_WIDE':
        return 1.0;
      case 'IRRELEVANT':
      default:
        return 0.0;
    }
  }

  /**
   * 9. Concentration Multiplier C_conc ∈ [1.0, 1.5]
   */
  public calculateConcentration(
    relevanceType: string,
    holdings: AssetHoldingInput[],
    matchedHoldingIds: string[],
    assetClassWeights: Record<string, number>
  ): number {
    const rel = (relevanceType || '').toUpperCase();
    if (rel === 'IRRELEVANT' || !holdings || holdings.length === 0) {
      return 1.0;
    }

    if (rel === 'DIRECT' || rel === 'INDIRECT') {
      if (!matchedHoldingIds || matchedHoldingIds.length === 0) return 1.0;
      const matchedSet = new Set(matchedHoldingIds.map(id => String(id).toLowerCase()));
      let wMaxMatched = 0.0;

      holdings.forEach(h => {
        const hId = (h.assetId || h.ticker || h.company || '').toLowerCase();
        if (matchedSet.has(hId)) {
          const w = this.normalizeWeight(h.currentWeight);
          if (w > wMaxMatched) wMaxMatched = w;
        }
      });

      return Math.max(1.0, Math.min(1.5, 1.0 + 0.5 * (wMaxMatched * wMaxMatched)));
    }

    if (rel === 'PORTFOLIO_WIDE') {
      let wMaxClass = 0.0;
      Object.values(assetClassWeights).forEach(w => {
        if (w > wMaxClass) wMaxClass = w;
      });
      return Math.max(1.0, Math.min(1.5, 1.0 + 0.25 * (wMaxClass * wMaxClass)));
    }

    return 1.0;
  }

  /**
   * 10. Portfolio Impact Score Formula
   * V_port = E_effective * T_port * C_conc * H_mult * R_mult
   * I_raw = 1 + (S_event - 1) * V_port
   * I_portfolio = clamp(1, 10, round(I_raw, 2))
   */
  public calculatePortfolioImpact(
    eventSeverity: number,
    effectiveExposure: number,
    transmissionSensitivity: number,
    concentration: number,
    horizon: string,
    relevanceType: string
  ): { rawImpact: number; portfolioImpact: number; vulnerability: number } {
    const relUpper = (relevanceType || '').toUpperCase();
    const rMult = RISK_ENGINE_CONFIG.relevanceMultiplier[relUpper] ?? 0.0;
    const horUpper = (horizon || 'SHORT_TERM').toUpperCase();
    const hMult = RISK_ENGINE_CONFIG.horizonMultiplier[horUpper] ?? 1.00;

    const vPort = effectiveExposure * transmissionSensitivity * concentration * hMult * rMult;
    const iRaw = 1.0 + (eventSeverity - 1.0) * vPort;
    const iPortfolio = Math.max(1.0, Math.min(10.0, parseFloat(iRaw.toFixed(2))));

    return {
      rawImpact: iRaw,
      portfolioImpact: iPortfolio,
      vulnerability: vPort
    };
  }

  /**
   * 11. Stress Exposure Factor E_stress
   * E_stress = E_effective * T_port * R_stress
   */
  public calculateStressExposure(effectiveExposure: number, transmissionSensitivity: number, relevanceType: string): number {
    const relUpper = (relevanceType || '').toUpperCase();
    const rStress = RISK_ENGINE_CONFIG.relevanceStressPathway[relUpper] ?? 0.0;
    const eStress = effectiveExposure * transmissionSensitivity * rStress;
    return Math.max(0.0, Math.min(1.0, eStress));
  }

  /**
   * 12. Generate Stress Parameters (Boundary Integer Rounding)
   * severityScale = S_event / 10
   * ParamShock = BaseShock * severityScale * E_stress * H_mult
   */
  public generateStressParameters(
    category: string,
    eventSeverity: number,
    stressExposure: number,
    horizon: string
  ): { rate: number; spread: number; liquidity: number; inflation: number; probability: number } {
    const baseShocks = RISK_ENGINE_CONFIG.baseStressShocks[category] ?? { rate: 100, spread: 150, liquidity: 15, inflation: 100 };
    const severityScale = eventSeverity / 10.0;
    const horUpper = (horizon || 'SHORT_TERM').toUpperCase();
    const hMult = RISK_ENGINE_CONFIG.horizonMultiplier[horUpper] ?? 1.00;

    const rawRate = baseShocks.rate * severityScale * stressExposure * hMult;
    const rawSpread = baseShocks.spread * severityScale * stressExposure * hMult;
    const rawLiquidity = baseShocks.liquidity * severityScale * stressExposure * hMult;
    const rawInflation = baseShocks.inflation * severityScale * stressExposure * hMult;

    // Display telemetry probability
    const rawProbability = stressExposure === 0 ? 0 : Math.min(50, Math.max(1, Math.round(15 * severityScale * stressExposure)));

    return {
      rate: Math.round(rawRate),
      spread: Math.round(rawSpread),
      liquidity: Math.round(rawLiquidity),
      inflation: Math.round(rawInflation),
      probability: rawProbability
    };
  }

  /**
   * 13. Model Confidence C_model = c_cat * c_sent * R_score (Telemetry Only)
   */
  public calculateModelConfidence(classificationConfidence?: number, sentimentConfidence?: number, relevanceScore?: number): number {
    const cCat = classificationConfidence !== undefined && !isNaN(classificationConfidence) ? classificationConfidence : 0.90;
    const cSent = sentimentConfidence !== undefined && !isNaN(sentimentConfidence) ? sentimentConfidence : 0.90;
    const rScore = relevanceScore !== undefined && !isNaN(relevanceScore) ? relevanceScore : 1.00;

    return parseFloat((cCat * cSent * rScore).toFixed(4));
  }

  /**
   * 14. Master calculateRisk Engine Call
   */
  public calculateRisk(event: RiskEventInput, portfolio: PortfolioInput, relevance: RelevanceInput): DeterministicRiskOutput {
    const category = event.category || 'Macroeconomic';
    const horizon = event.horizon || 'SHORT_TERM';
    const baseline = portfolio.baselineValue || 1000.0;

    // Reconciliation check
    let reconciliationWarning: string | undefined = undefined;
    if (portfolio.holdings && portfolio.holdings.length > 0) {
      const sumHoldings = portfolio.holdings.reduce((sum, h) => {
        const val = h.currentValue !== undefined ? Math.max(0, h.currentValue) : (this.normalizeWeight(h.currentWeight) * baseline);
        return sum + val;
      }, 0);
      if (Math.abs(sumHoldings - baseline) > 0.0001 * baseline) {
        reconciliationWarning = `Portfolio holdings total (${sumHoldings.toFixed(2)}) differs from baseline_value (${baseline.toFixed(2)}). Using baseline_value as canonical denominator.`;
      }
    }

    const eventSeverity = this.calculateEventSeverity(category, event.sentiment);
    const severityScale = eventSeverity / 10.0;
    const assetClassWeights = this.calculateAssetClassWeights(portfolio.holdings, baseline);
    const transmissionSensitivity = this.calculateTransmissionSensitivity(assetClassWeights, category);

    const directExp = this.calculateDirectExposure(portfolio.holdings, relevance.matchedHoldingIds || [], baseline);
    const indirectExp = this.calculateIndirectExposure(portfolio.holdings, relevance.matchedSectors || [], baseline);
    const effectiveExposure = this.calculateEffectiveExposure(relevance.relevanceType, directExp, indirectExp);

    const concentration = this.calculateConcentration(
      relevance.relevanceType,
      portfolio.holdings,
      relevance.matchedHoldingIds || [],
      assetClassWeights
    );

    const impactResult = this.calculatePortfolioImpact(
      eventSeverity,
      effectiveExposure,
      transmissionSensitivity,
      concentration,
      horizon,
      relevance.relevanceType
    );

    const stressExposure = this.calculateStressExposure(effectiveExposure, transmissionSensitivity, relevance.relevanceType);
    const stressParameters = this.generateStressParameters(category, eventSeverity, stressExposure, horizon);
    const modelConfidence = this.calculateModelConfidence(
      event.classificationConfidence,
      event.sentimentConfidence,
      relevance.relevanceScore
    );

    return {
      eventSeverity,
      severityScale,
      effectiveExposure,
      transmissionSensitivity,
      concentration,
      vulnerabilityMultiplier: impactResult.vulnerability,
      rawImpact: impactResult.rawImpact,
      portfolioImpact: impactResult.portfolioImpact,
      stressExposure,
      modelConfidence,
      stressParameters,
      assetClassWeights,
      reconciliationWarning
    };
  }
}

export const deterministicRiskEngine = new DeterministicRiskEngine();
