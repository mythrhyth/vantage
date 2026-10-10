import { PortfolioService } from '../src/services/portfolios/portfolio.service';
import { prisma } from '../src/server';

async function testPortfolioWorkflow() {
  console.log('==================================================');
  console.log('RUNNING PORTFOLIO SETUP WORKFLOW ACCEPTANCE TESTS');
  console.log('==================================================\n');

  const portfolioService = new PortfolioService();

  // 1. Fetch default portfolio
  const portfolios = await portfolioService.listPortfolios();
  if (portfolios.length === 0) {
    console.error('❌ FAIL: No portfolio found in database');
    process.exit(1);
  }
  const testPortId = portfolios[0].id;
  console.log(`✅ 1. Found active portfolio ID: ${testPortId}`);

  const newHoldings = [
    { ticker: 'AAPL', company: 'Apple Inc.', currentWeight: 4, sector: 'Technology' },
    { ticker: 'MSFT', company: 'Microsoft Corp.', currentWeight: 3, sector: 'Technology' },
    { ticker: 'GOOGL', company: 'Alphabet Inc.', currentWeight: 2, sector: 'Technology' },
    { ticker: 'JPM', company: 'JPMorgan Chase & Co.', currentWeight: 1, sector: 'Financials' }
  ];

  // 2. Fetch full portfolio details
  const initialPort = await portfolioService.getPortfolio(testPortId);
  console.log(`✅ 2. Loaded initial portfolio details:`, {
    name: initialPort?.name,
    baseline_value: initialPort?.baseline_value,
    index_universe: initialPort?.index_universe,
    exposures: initialPort?.exposures,
    assetsCount: initialPort?.assets.length
  });

  // 3. Test Portfolio Update (Baseline value, index universe, exposures)
  console.log('\n--- Testing Portfolio Metadata Update ---');
  const updatedPort = await portfolioService.updatePortfolio(testPortId, {
    name: 'Primary Financial Intelligence Portfolio',
    baselineValue: 3000,
    indexUniverse: 'S&P 500',
    loansExposure: 1500,
    bondsExposure: 900,
    derivativesExposure: 300,
    holdings: newHoldings
  });

  if (
    updatedPort?.baseline_value === 3000 &&
    updatedPort?.index_universe === 'S&P 500' &&
    updatedPort?.exposures.loans === 1500 &&
    updatedPort?.exposures.bonds === 900 &&
    updatedPort?.exposures.derivatives === 300
  ) {
    console.log('✅ 3. Portfolio metadata and asset exposures updated successfully in PostgreSQL DB');
  } else {
    console.error('❌ FAIL: Portfolio update mismatch:', updatedPort);
    process.exit(1);
  }

  // 4. Test Holdings Validation (Negative weight)
  console.log('\n--- Testing Equity Holdings Validation ---');
  try {
    await portfolioService.updateHoldings(testPortId, [
      { ticker: 'AAPL', company: 'Apple Inc.', currentWeight: -5 }
    ]);
    console.error('❌ FAIL: Failed to reject negative weight');
    process.exit(1);
  } catch (e: any) {
    console.log('✅ 4. Rejection of negative stock weight verified:', e.message);
  }

  // 5. Test Holdings Validation (Duplicate tickers)
  try {
    await portfolioService.updateHoldings(testPortId, [
      { ticker: 'AAPL', company: 'Apple Inc.', currentWeight: 10 },
      { ticker: 'AAPL', company: 'Apple Duplicate', currentWeight: 15 }
    ]);
    console.error('❌ FAIL: Failed to reject duplicate tickers');
    process.exit(1);
  } catch (e: any) {
    console.log('✅ 5. Rejection of duplicate ticker verified:', e.message);
  }

  // 6. Test Holdings Validation (Sum > 100%)
  try {
    await portfolioService.updateHoldings(testPortId, [
      { ticker: 'AAPL', company: 'Apple Inc.', currentWeight: 60 },
      { ticker: 'MSFT', company: 'Microsoft Corp.', currentWeight: 50 }
    ]);
    console.error('❌ FAIL: Failed to reject sum > 100%');
    process.exit(1);
  } catch (e: any) {
    console.log('✅ 6. Rejection of total weight > 100% verified:', e.message);
  }

  // 7. Test Valid Equity Holdings Save
  console.log('\n--- Testing Valid Equity Holdings Update ---');
  const savedPort = await portfolioService.updateHoldings(testPortId, newHoldings);
  const stockAssets = savedPort?.assets.filter(a => a.asset_type === 'Stock' || a.asset_type === 'EQUITY');

  if (stockAssets?.length === 4 && savedPort?.exposures.total_equity_weight === 10) {
    console.log('✅ 7. Valid holdings saved and weight calculations match:', {
      stocksCount: stockAssets.length,
      totalEquityWeight: savedPort.exposures.total_equity_weight,
      equityExposure: savedPort.exposures.equity
    });
  } else {
    console.error('❌ FAIL: Saved holdings mismatch:', stockAssets);
    process.exit(1);
  }

  let imbalanceRejected = false;
  try {
    await portfolioService.updateHoldings(testPortId, [
      ...newHoldings,
      { ticker: 'TSLA', company: 'Tesla Inc.', currentWeight: 1, sector: 'Automotive' }
    ]);
  } catch (error) {
    imbalanceRejected = error instanceof Error && error.message.includes('Asset exposures total');
  }
  assert(imbalanceRejected, 'Equity update must reject asset exposures that exceed the configured baseline');
  console.log('✅ 7a. Rejection of unreconciled portfolio exposures verified');

  // 8. Re-verify database persistence directly from Prisma
  console.log('\n--- Testing DB Persistence ---');
  const dbPort = await prisma.portfolio.findUnique({
    where: { id: testPortId },
    include: { assets: true }
  });

  if (dbPort && (dbPort as any).index_universe === 'S&P 500' && Number(dbPort.baseline_value) === 3000) {
    console.log('✅ 8. Database persistence verified cleanly in Neon PostgreSQL DB');
  } else {
    console.error('❌ FAIL: DB record does not reflect updates:', dbPort);
    process.exit(1);
  }

  console.log('\n==================================================');
  console.log('ALL PORTFOLIO SETUP ACCEPTANCE TESTS PASSED! 🎉');
  console.log('==================================================');
  await prisma.$disconnect();
}

testPortfolioWorkflow().catch(e => {
  console.error('Test execution error:', e);
  process.exit(1);
});
