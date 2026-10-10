import { PrismaClient } from '@prisma/client'
import { events, stocks, scenarioData } from '../../src/data/mockData'

const prisma = new PrismaClient()

async function main() {
  const portfolio = await prisma.portfolio.create({
    data: {
      name: 'Primary Banking Portfolio',
      baseline_value: 2450.0
    }
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

  // Risk events are no longer seeded from mock data.
  // The system strictly relies on the real ingestion pipeline.

  for (const [name, params] of Object.entries(scenarioData)) {
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

main().catch(console.error).finally(() => prisma.$disconnect())
