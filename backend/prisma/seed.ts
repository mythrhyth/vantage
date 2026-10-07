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
    asset_type: 'Stock',
    sector: stock.sector || 'Unknown',
    current_weight: stock.current,
    sentiment: stock.sentiment,
    base_sentiment: stock.base
  }))
  await prisma.asset.createMany({ data: assetsToCreate })

  await prisma.asset.createMany({
    data: [
      { portfolio_id: portfolio.id, asset_type: 'Loan', current_weight: 1360 / 2450 * 100, sentiment: 0, base_sentiment: 0 },
      { portfolio_id: portfolio.id, asset_type: 'Bond', current_weight: 800 / 2450 * 100, sentiment: 0, base_sentiment: 0 },
      { portfolio_id: portfolio.id, asset_type: 'Derivative', current_weight: 290 / 2450 * 100, sentiment: 0, base_sentiment: 0 }
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
