export type Page = "Home" | "Overview" | "Risk Intelligence" | "Index Allocation" | "Portfolio Stress Testing" | "Scenarios" | "Scenario Analysis" | "Profile" | "Workspace Settings" | "Portfolio Setup"

export type IconName = "overview" | "intelligence" | "allocation" | "stress" | "scenario" | "sun" | "moon" | "arrow" | "reset" | "close" | "user" | "settings" | "info" | "portfolio"

export type EventCategory = 
  | 'Monetary policy'
  | 'Credit'
  | 'Macroeconomic'
  | 'Commodities'
  | 'Geopolitical'
  | 'Sector outlook'
  | 'Earnings'
  | 'Regulatory'

export type ImpactLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface RiskEvent {
  id: string
  title: string
  source?: string
  url?: string
  category: EventCategory | string
  classification_confidence?: number
  sentiment: number
  sentiment_label?: string
  sentiment_confidence?: number
  impact_level?: ImpactLevel | string
  impact_score?: number
  impact_reason?: string
  summary?: string
  affected_assets?: string[]
  affected_sectors?: string[]
  horizon?: string
  published_at?: string
  created_at?: string
}

export interface AssetHolding {
  id?: string
  ticker: string
  company: string
  currentWeight: number
  targetWeight?: number
  currentValue?: number
  assetClass?: 'LOANS' | 'BONDS' | 'DERIVATIVES' | 'EQUITY' | string
  sector?: string
}

export interface Portfolio {
  id: string
  name: string
  baselineValue: number
  indexUniverse?: string
  loansExposure?: number
  bondsExposure?: number
  derivativesExposure?: number
  holdings?: AssetHolding[]
  createdAt?: string
  updatedAt?: string
}

export interface ProposedWeight {
  ticker: string
  id?: string
  name?: string
  sector?: string
  current_weight: number
  proposed_weight: number
  delta: number
  status: 'OPTIMAL' | 'CAP_REACHED' | 'EXCLUDED' | string
  reason?: string
}

export interface StressTestParameters {
  sp500_shock_pct?: number
  interest_rate_shock_bps?: number
  credit_spread_shock_bps?: number
  inflation_shock_pct?: number
  default_probability_pct?: number
  liquidity_haircut_pct?: number
  gdp_contraction_pct?: number
  oil_price_shock_pct?: number
  fx_usd_inr_pct?: number
  tech_sector_shock_pct?: number
}

export interface DriverTrace {
  driver_id: string
  driver_name: string
  affected_asset_classes: string[]
  parameter_value: number
  unit: string
  formula: string
  modeled_loss_cr: number
  interpretation: string
}

export interface AttributionResult {
  baseline_value: number
  stressed_value: number
  net_loss: number
  risk_score: number
  asset_breakdown?: Record<string, number>
  factor_breakdown?: Record<string, number>
  interaction_residual?: number
  calculation_trace?: {
    total_baseline: number
    total_net_loss: number
    total_stressed: number
    drivers: DriverTrace[]
  }
}

export type StressTestRun = {
  event?: RiskEvent
  scenario?: string
  parameters?: StressTestParameters
  runId?: string
  id?: string
  portfolio_id?: string
  portfolio_name?: string
  scenario_id?: string
  event_id?: string
  run_type?: "manual" | "preset" | "event_driven" | "default" | "unknown"
  displayTitle?: string
  parameterSource?: string
  parameter_source?: string
  baselineValue?: number
  stressedValue?: number
  absoluteLoss?: number
  loss?: number
  riskScore?: number
  attributionResult?: AttributionResult
  attribution_result?: AttributionResult
  skipProcessing?: boolean
  status?: string
}

export type StressTestHistoryEntry = StressTestRun & {
  loss: number
  completedAt: string
}

export type AssetName = "Loans" | "Bonds" | "Derivatives" | "Liquidity"

