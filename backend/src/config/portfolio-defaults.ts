export const DEFAULT_PORTFOLIO_BASELINE = 2450;

export const DEFAULT_PORTFOLIO_ASSETS = [
  { ticker: 'AAPL', company: 'Apple Inc.', asset_type: 'EQUITY', sector: 'Technology', current_weight: 0.06 },
  { ticker: 'MSFT', company: 'Microsoft Corp.', asset_type: 'EQUITY', sector: 'Technology', current_weight: 0.055 },
  { ticker: 'GOOGL', company: 'Alphabet Inc.', asset_type: 'EQUITY', sector: 'Communication Services', current_weight: 0.045 },
  { ticker: 'AMZN', company: 'Amazon.com Inc.', asset_type: 'EQUITY', sector: 'Consumer Staples', current_weight: 0.04 },
  { ticker: 'NVDA', company: 'NVIDIA Corp.', asset_type: 'EQUITY', sector: 'Technology', current_weight: 0.04 },
  { ticker: 'JPM', company: 'JPMorgan Chase & Co.', asset_type: 'EQUITY', sector: 'Financial Services', current_weight: 0.035 },
  { ticker: 'META', company: 'Meta Platforms Inc.', asset_type: 'EQUITY', sector: 'Communication Services', current_weight: 0.03 },
  { ticker: 'TSLA', company: 'Tesla Inc.', asset_type: 'EQUITY', sector: 'Automotive', current_weight: 0.025 },
  { ticker: 'RELIANCE', company: 'Reliance Industries Ltd', asset_type: 'EQUITY', sector: 'Energy', current_weight: 0.03 },
  { ticker: 'TCS', company: 'Tata Consultancy Services', asset_type: 'EQUITY', sector: 'Technology', current_weight: 0.025 },
  { ticker: 'HDFCBANK', company: 'HDFC Bank Ltd', asset_type: 'EQUITY', sector: 'Financial Services', current_weight: 0.025 },
  { ticker: 'INFYS', company: 'Infosys Ltd', asset_type: 'EQUITY', sector: 'Technology', current_weight: 0.02 },
  { ticker: null, company: 'Corporate Loans Portfolio', asset_type: 'LOANS', sector: 'Banking & Credit', current_weight: 0.30 },
  { ticker: null, company: 'Sovereign & Corporate Bonds', asset_type: 'BONDS', sector: 'Fixed Income', current_weight: 0.17 },
  { ticker: null, company: 'Interest Rate Derivatives', asset_type: 'DERIVATIVES', sector: 'Hedging', current_weight: 0.10 }
] as const;

export const DEFAULT_SCENARIOS = [
  { name: 'Interest Rate Shock', rate: 250, spread: 120, probability: 2, liquidity: 8, inflation: 150 },
  { name: 'Credit Crisis', rate: -50, spread: 350, probability: 8, liquidity: 20, inflation: 50 },
  { name: 'Combined Macro Stress', rate: 150, spread: 250, probability: 5, liquidity: 15, inflation: 200 }
] as const;
