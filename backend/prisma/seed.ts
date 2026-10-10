import { PrismaClient } from '@prisma/client';
import { DEFAULT_PORTFOLIO_ASSETS, DEFAULT_PORTFOLIO_BASELINE, DEFAULT_SCENARIOS } from '../src/config/portfolio-defaults';

const prisma = new PrismaClient();

async function main() {
  let portfolio = await prisma.portfolio.findFirst();

  if (!portfolio) {
    portfolio = await prisma.portfolio.create({
      data: {
        name: 'Main Wealth Fund Portfolio',
        baseline_value: DEFAULT_PORTFOLIO_BASELINE,
        index_universe: 'NIFTY50',
        assets: {
          create: DEFAULT_PORTFOLIO_ASSETS.map(asset => ({
            ...asset,
            exposure_value: asset.current_weight * DEFAULT_PORTFOLIO_BASELINE,
            sentiment: 0,
            base_sentiment: 0
          }))
        }
      }
    });
  }

  const existingScenarios = await prisma.scenario.findMany({ select: { name: true } });
  const existingScenarioNames = new Set(existingScenarios.map(scenario => scenario.name));
  const missingScenarios = DEFAULT_SCENARIOS.filter(scenario => !existingScenarioNames.has(scenario.name));

  if (missingScenarios.length > 0) {
    await prisma.scenario.createMany({ data: [...missingScenarios] });
  }

  console.log(`Seed defaults available. Preserved existing portfolio data for "${portfolio.name}" (${portfolio.id}).`);
}

main()
  .catch(error => {
    console.error('Failed to seed default portfolio data:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
