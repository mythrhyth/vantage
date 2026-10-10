import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const stocks = [
  { ticker: 'AAPL', company: 'Apple Inc.', sector: 'Technology', current: 6.0 },
  { ticker: 'MSFT', company: 'Microsoft Corp.', sector: 'Technology', current: 5.5 },
  { ticker: 'GOOGL', company: 'Alphabet Inc.', sector: 'Communication Services', current: 4.5 },
  { ticker: 'AMZN', company: 'Amazon.com Inc.', sector: 'Consumer Staples', current: 4.0 },
  { ticker: 'NVDA', company: 'NVIDIA Corp.', sector: 'Technology', current: 4.0 },
  { ticker: 'JPM', company: 'JPMorgan Chase & Co.', sector: 'Financial Services', current: 3.5 },
  { ticker: 'META', company: 'Meta Platforms Inc.', sector: 'Communication Services', current: 3.0 },
  { ticker: 'TSLA', company: 'Tesla Inc.', sector: 'Automotive', current: 2.5 },
  { ticker: 'RELIANCE', company: 'Reliance Industries Ltd', sector: 'Energy', current: 3.0 },
  { ticker: 'TCS', company: 'Tata Consultancy Services', sector: 'Technology', current: 2.5 },
  { ticker: 'HDFCBANK', company: 'HDFC Bank Ltd', sector: 'Financial Services', current: 2.5 },
  { ticker: 'INFYS', company: 'Infosys Ltd', sector: 'Technology', current: 2.0 }
]

const scenarioData: Record<string, { rate: number; spread: number; probability: number; liquidity: number; inflation: number }> = {
  "Rate Hike 100bps": { rate: 1.0, spread: 0.5, probability: 0.35, liquidity: -0.2, inflation: 0.5 },
  "Credit Crunch": { rate: 0.5, spread: 2.5, probability: 0.15, liquidity: -0.8, inflation: -0.2 },
  "Tech Selloff": { rate: -0.2, spread: 1.0, probability: 0.25, liquidity: -0.4, inflation: 0.1 },
  "Stagflation": { rate: 1.5, spread: 1.8, probability: 0.20, liquidity: -0.5, inflation: 2.0 }
}

async function main() {
  let portfolio = await prisma.portfolio.findFirst({
    where: {
      name: { in: ['Primary Banking Portfolio', 'Main Wealth Fund Portfolio'] }
    }
  })

  if (!portfolio) {
    portfolio = await prisma.portfolio.create({
      data: {
        name: 'Primary Banking Portfolio',
        baseline_value: 2450.0
      }
    })
  }

  await prisma.asset.deleteMany({
    where: { portfolio_id: portfolio.id }
  })

  const assetsToCreate = stocks.map(stock => ({
    portfolio_id: portfolio.id,
    ticker: stock.ticker,
    company: stock.company,
    asset_type: 'EQUITY',
    sector: stock.sector || 'Unknown',
    current_weight: stock.current / 100,
    exposure_value: (stock.current / 100) * 2450.0,
    sentiment: 0.0,
    base_sentiment: 0.0
  }))
  await prisma.asset.createMany({ data: assetsToCreate })

  await prisma.asset.createMany({
    data: [
      { portfolio_id: portfolio.id, company: 'Corporate Loans Portfolio', asset_type: 'LOANS', sector: 'Banking & Credit', current_weight: 0.30, exposure_value: 0.30 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 },
      { portfolio_id: portfolio.id, company: 'Sovereign & Corporate Bonds', asset_type: 'BONDS', sector: 'Fixed Income', current_weight: 0.17, exposure_value: 0.17 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 },
      { portfolio_id: portfolio.id, company: 'Interest Rate Derivatives', asset_type: 'DERIVATIVES', sector: 'Hedging', current_weight: 0.10, exposure_value: 0.10 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 }
    ]
  })

  for (const [name, params] of Object.entries(scenarioData)) {
    const existing = await prisma.scenario.findFirst({ where: { name } })
    if (!existing) {
      await prisma.scenario.create({
        data: {
          name,
          rate: params.rate,
          spread: params.spread,
          probability: params.probability,
          liquidity: params.liquidity,
          inflation: params.inflation
        }
      })
    }
  }
  console.log(`Successfully seeded portfolio "${portfolio.name}" (${portfolio.id}) with 12 equities and 3 non-equity assets.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
