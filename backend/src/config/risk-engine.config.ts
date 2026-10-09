export const RISK_ENGINE_CONFIG = {
  /**
   * Category Base Severities (S_cat) ∈ [1.0, 10.0]
   * PROPOSED CALIBRATION PARAMETERS — REQUIRES VALIDATION
   */
  categoryBaseSeverity: {
    'Monetary policy': 8.5,
    'Credit': 8.0,
    'Macroeconomic': 7.5,
    'Commodities': 7.0,
    'Geopolitical': 7.0,
    'Sector outlook': 6.0,
    'Earnings': 5.5,
    'Regulatory': 5.0,
  } as Record<string, number>,

  /**
   * Relevance Multiplier (R_mult) for Vulnerability Calculation
   * PROPOSED CALIBRATION PARAMETERS — REQUIRES VALIDATION
   */
  relevanceMultiplier: {
    DIRECT: 1.00,
    INDIRECT: 0.85,
    PORTFOLIO_WIDE: 0.70,
    IRRELEVANT: 0.00,
  } as Record<string, number>,

  /**
   * Relevance Stress Pathway Factor (R_stress) for Parameter Shocks
   * PROPOSED CALIBRATION PARAMETERS — REQUIRES VALIDATION
   */
  relevanceStressPathway: {
    DIRECT: 1.00,
    INDIRECT: 0.85,
    PORTFOLIO_WIDE: 0.70,
    IRRELEVANT: 0.00,
  } as Record<string, number>,

  /**
   * Horizon Multiplier (H_mult)
   * PROPOSED CALIBRATION PARAMETERS — REQUIRES VALIDATION
   */
  horizonMultiplier: {
    IMMEDIATE: 1.15,
    SHORT_TERM: 1.00,
    MEDIUM_TERM: 0.85,
    LONG_TERM: 0.70,
  } as Record<string, number>,

  /**
   * Category × Asset-Class Sensitivity Matrix (W_category,asset)
   * PROPOSED CALIBRATION PARAMETERS — REQUIRES VALIDATION
   */
  categoryAssetMatrix: {
    'Monetary policy': { LOANS: 0.70, BONDS: 1.00, DERIVATIVES: 0.60, EQUITY: 0.40 },
    'Credit':          { LOANS: 0.85, BONDS: 0.90, DERIVATIVES: 0.50, EQUITY: 0.30 },
    'Macroeconomic':   { LOANS: 0.60, BONDS: 0.70, DERIVATIVES: 0.55, EQUITY: 0.65 },
    'Commodities':     { LOANS: 0.30, BONDS: 0.40, DERIVATIVES: 0.85, EQUITY: 0.60 },
    'Geopolitical':    { LOANS: 0.40, BONDS: 0.50, DERIVATIVES: 0.75, EQUITY: 0.70 },
    'Sector outlook':  { LOANS: 0.30, BONDS: 0.30, DERIVATIVES: 0.60, EQUITY: 0.85 },
    'Earnings':        { LOANS: 0.10, BONDS: 0.20, DERIVATIVES: 0.40, EQUITY: 1.00 },
    'Regulatory':      { LOANS: 0.40, BONDS: 0.30, DERIVATIVES: 0.50, EQUITY: 0.60 },
  } as Record<string, Record<string, number>>,

  /**
   * Base Parameter Stress Shocks (BaseShock_category,param)
   * Aligned with production Scenario schema: rate (bps), spread (bps), liquidity (%), inflation (bps)
   * PROPOSED CALIBRATION PARAMETERS — REQUIRES VALIDATION
   */
  baseStressShocks: {
    'Monetary policy': { rate: 250, spread: 120, liquidity: 10, inflation: 150 },
    'Credit':          { rate: -50, spread: 350, liquidity: 20, inflation: 50 },
    'Macroeconomic':   { rate: 150, spread: 250, liquidity: 15, inflation: 200 },
    'Commodities':     { rate: 100, spread: 150, liquidity: 15, inflation: 300 },
    'Geopolitical':    { rate: 100, spread: 200, liquidity: 25, inflation: 150 },
    'Sector outlook':  { rate: -50, spread: 180, liquidity: 15, inflation: 50 },
    'Earnings':        { rate: -30, spread: 150, liquidity: 10, inflation: -50 },
    'Regulatory':      { rate: 20, spread: 120, liquidity: 15, inflation: 50 },
  } as Record<string, { rate: number; spread: number; liquidity: number; inflation: number }>,
};
