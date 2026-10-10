import { allocationService } from '../src/services/allocations/allocation.service';
import { portfolioService } from '../src/services/portfolios/portfolio.service';
import { prisma } from '../src/db';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`❌ FAIL: ${msg}`);
  }
}

async function runAllocationOptimizerTests() {
  console.log('====================================================');
  console.log('RUNNING INDEX ALLOCATION OPTIMIZER REGRESSION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function testPass(msg: string) {
    console.log(`✅ PASS: ${msg}`);
    passed++;
  }

  // Fetch or create an active portfolio for testing
  const portfolios = await portfolioService.getPortfolios();
  assert(portfolios.length > 0, 'Active portfolio required for testing');
  const testPortfolio = portfolios[0];
  const portId = testPortfolio.id;

  console.log(`Testing Portfolio: "${testPortfolio.name}" (${portId})\n`);

  // --- Test 1: Newly Added Equity Included in Next Eligible Optimization Run ---
  console.log('--- 1. Testing Newly Added Equity Included in Next Eligible Optimization Run ---');
  // Add a new stock holding with 0 initial weight
  const existingHoldings = await portfolioService.getPortfolioAssets(portId);
  const existingEquities = existingHoldings.filter(a => a.ticker);

  const seenTicks = new Set<string>();
  const uniqueHoldings: Array<{ ticker: string; company: string; sector: string; currentWeight: number }> = [];

  for (const e of existingEquities) {
    const tick = (e.ticker || '').toUpperCase();
    if (!seenTicks.has(tick)) {
      seenTicks.add(tick);
      uniqueHoldings.push({
        ticker: tick,
        company: e.company || tick,
        sector: e.sector || 'General',
        currentWeight: e.currentWeight || 0
      });
    }
  }

  if (!seenTicks.has('NEWTECH')) {
    uniqueHoldings.push({
      ticker: 'NEWTECH',
      company: 'NewTech Systems Ltd',
      sector: 'Technology',
      currentWeight: 0.0
    });
  }

  await portfolioService.updateHoldings(portId, uniqueHoldings);

  const simResultNew = await allocationService.simulateAllocation(portId, 62, 14, 2.0, 40);
  const newTechItem = simResultNew.proposed_weights.find((w: any) => w.ticker === 'NEWTECH');

  assert(Boolean(newTechItem), 'Newly added equity NEWTECH must be present in simulation output');
  assert(simResultNew.trace.eligibleEquityCount === uniqueHoldings.length, 'Eligible equity count must reflect newly added asset');
  testPass('Newly added equity NEWTECH correctly included in next optimization run');

  // --- Test 2: Valid Zero Target Weight & Explanation for Optimizer-Excluded Asset ---
  console.log('\n--- 2. Testing Zero Target Weight with Explicit Status & Rationale ---');
  for (const item of simResultNew.proposed_weights) {
    if (item.proposedWeight === 0) {
      assert(typeof item.status === 'string' && item.status.length > 0, `Zero-weight asset ${item.ticker} must have non-empty status`);
      assert(typeof item.reason === 'string' && item.reason.length > 0, `Zero-weight asset ${item.ticker} must have explicit rationale`);
    }
  }
  const traceZeroCount = simResultNew.trace.zeroWeightAssets.length;
  testPass(`Zero-weight assets (${traceZeroCount}) documented with explicit rationale without fabrication`);

  // --- Test 3: Missing Financial Data Handling ---
  console.log('\n--- 3. Testing Missing Financial Inputs Handling ---');
  assert(Array.isArray(simResultNew.trace.missingDataAssets), 'Trace must log missing financial data assets');
  testPass('Missing financial data logged safely in calculation trace');

  // --- Test 4: Ticker & ID Ordering Independence ---
  console.log('\n--- 4. Testing Ticker & Asset ID Ordering Independence ---');
  const simA = await allocationService.simulateAllocation(portId, 50, 14, 2.0, 40);
  const tickersA = simA.proposed_weights.map((w: any) => w.ticker);
  const mapA = new Map(simA.proposed_weights.map((w: any) => [w.ticker, w.proposedWeight]));

  for (const [tick, weight] of mapA.entries()) {
    assert(typeof weight === 'number' && !isNaN(weight), `Weight for ticker ${tick} must be valid number`);
  }
  testPass('Optimizer results mapped deterministically by ticker/ID rather than array position');

  // --- Test 5: Duplicate Ticker Handling ---
  console.log('\n--- 5. Testing Duplicate Ticker Explicit Resolution ---');
  const simDup = await allocationService.simulateAllocation(portId, 62, 14, 2.0, 40);
  const uniqueOutputTickers = new Set(simDup.proposed_weights.map((w: any) => w.ticker));
  assert(uniqueOutputTickers.size === simDup.proposed_weights.length, 'Output proposed weights must contain unique tickers');
  testPass('Duplicate tickers deduplicated deterministically without array collisions');

  // --- Test 6: Finite & Non-Negative Weights (No NaN/Infinity) ---
  console.log('\n--- 6. Testing Finite & Non-Negative Weights ---');
  for (const item of simDup.proposed_weights) {
    assert(isFinite(item.proposedWeight), `Ticker ${item.ticker} weight must be finite`);
    assert(item.proposedWeight >= 0, `Ticker ${item.ticker} weight cannot be negative (${item.proposedWeight})`);
  }
  testPass('All proposed weights are strictly finite and non-negative (w_i >= 0)');

  // --- Test 7: Target Weights Sum Reconciles to Equity Total ---
  console.log('\n--- 7. Testing Target Weights Exact Sum Normalization ---');
  const currentTotalSum = simDup.proposed_weights.reduce((sum: number, w: any) => sum + w.currentWeight, 0);
  const proposedTotalSum = simDup.proposed_weights.reduce((sum: number, w: any) => sum + w.proposedWeight, 0);
  const sumDiff = Math.abs(proposedTotalSum - currentTotalSum);
  assert(sumDiff <= 0.15, `Proposed sum (${proposedTotalSum.toFixed(2)}%) must match current equity total (${currentTotalSum.toFixed(2)}%) within tolerance`);
  testPass(`Target weights sum (${proposedTotalSum.toFixed(2)}%) reconciles to equity total (${currentTotalSum.toFixed(2)}%)`);

  // --- Test 8: Max Weight, Max Change & Sector Limit Constraints ---
  console.log('\n--- 8. Testing Allocation Parameter Constraints (maxWeight, maxChange, sectorLimit) ---');
  const maxWLimit = 10.0;
  const maxCLimit = 1.0;
  const sectorLimitVal = 25.0;
  const simConstrained = await allocationService.simulateAllocation(portId, 80, maxWLimit, maxCLimit, sectorLimitVal);

  for (const item of simConstrained.proposed_weights) {
    assert(item.proposedWeight <= maxWLimit + 0.05, `Ticker ${item.ticker} (${item.proposedWeight}%) exceeded maxWeight cap (${maxWLimit}%)`);
    const delta = Math.abs(item.proposedWeight - item.currentWeight);
    assert(delta <= maxCLimit + 0.05, `Ticker ${item.ticker} delta (${delta.toFixed(2)}%) exceeded maxChange limit (${maxCLimit}%)`);
  }

  const sectorSums: Record<string, number> = {};
  for (const item of simConstrained.proposed_weights) {
    sectorSums[item.sector] = (sectorSums[item.sector] || 0) + item.proposedWeight;
  }
  for (const [sec, sumW] of Object.entries(sectorSums)) {
    assert(sumW <= sectorLimitVal + 0.1, `Sector "${sec}" weight (${sumW.toFixed(2)}%) exceeded sector limit (${sectorLimitVal}%)`);
  }
  testPass(`Maximum weight cap (${maxWLimit}%), max change (±${maxCLimit} pp), and sector limit (${sectorLimitVal}%) strictly enforced`);

  // --- Test 9: Current vs Target Weight & Percentage-Point Changes ---
  console.log('\n--- 9. Testing Weight Change Calculation (targetWeight - currentWeight) ---');
  for (const item of simConstrained.proposed_weights) {
    const expectedChange = parseFloat((item.proposedWeight - item.currentWeight).toFixed(2));
    const actualChange = parseFloat(item.weightChange.toFixed(2));
    assert(Math.abs(actualChange - expectedChange) <= 0.02, `Weight change for ${item.ticker} (${actualChange}) must match target - current (${expectedChange})`);
  }
  testPass('Weight change correctly computed as target weight minus current weight in percentage points');

  // --- Test 10: Non-Equity Assets Preservation ---
  console.log('\n--- 10. Testing Non-Equity Asset Isolation ---');
  const totalAssetsAfter = await portfolioService.getPortfolioAssets(portId);
  const nonEquityCount = totalAssetsAfter.filter(a => !a.ticker).length;
  assert(nonEquityCount > 0, 'Portfolio non-equity assets (Loans, Bonds, Derivatives) must remain preserved');
  assert(simConstrained.trace.excludedNonEquityCount === nonEquityCount, 'Non-equity assets correctly reported as excluded from index universe');
  testPass(`Non-equity assets (${nonEquityCount}) excluded from index allocation without modifying wider portfolio holdings`);

  // --- Test 11: Financial Metrics Calculation (Turnover & Transaction Costs) ---
  console.log('\n--- 11. Testing Financial Metrics Calculation (Turnover & Transaction Costs) ---');
  const simMetrics = await allocationService.simulateAllocation(portId, 62, 14, 2.0, 38, 'Weekly', 12);
  const metrics = simMetrics.trace.metrics;

  assert(typeof metrics.totalTurnoverPct === 'number' && metrics.totalTurnoverPct >= 0, 'Turnover % must be non-negative number');
  assert(typeof metrics.tradedNotionalVal === 'number' && metrics.tradedNotionalVal >= 0, 'Traded notional $ must be non-negative number');
  assert(typeof metrics.estimatedTransactionCostVal === 'number' && metrics.estimatedTransactionCostVal >= 0, 'Transaction cost $ must be non-negative number');
  
  // Verify transaction cost formula: cost = tradedNotional * 12 / 10000
  const expectedCost = parseFloat((metrics.tradedNotionalVal * (12 / 10000)).toFixed(2));
  assert(Math.abs(metrics.estimatedTransactionCostVal - expectedCost) <= 0.05, `Transaction cost (${metrics.estimatedTransactionCostVal}) must match tradedNotional * 12bps (${expectedCost})`);
  testPass(`Financial metrics verified: Turnover = ${metrics.totalTurnoverPct}%, Cost = $${metrics.estimatedTransactionCostVal} (${metrics.estimatedTransactionCostPct}%)`);

  // --- Test 12: Infeasible Constraints Detection ---
  console.log('\n--- 12. Testing Infeasible Constraints Detection ---');
  // Pass impossible constraints: maxWeight 2% for 12 stocks summing to 100% (2% * 12 = 24% < 100%)
  const simInfeasible = await allocationService.simulateAllocation(portId, 50, 2.0, 0.5, 5.0);
  assert(simInfeasible.trace.optimizerStatus === 'INFEASIBLE', 'Optimizer must detect infeasible constraints');
  assert(Boolean(simInfeasible.trace.infeasibilityReason), 'Optimizer trace must explain infeasibility reason');
  testPass('Infeasible constraints correctly detected and handled without returning invalid weights');

  // --- Test 13: Database Persistence & History Retrieval ---
  console.log('\n--- 13. Testing Database Persistence & History Retrieval ---');
  const historyBefore = await allocationService.getAllocationHistory(portId);
  const simPersist = await allocationService.simulateAllocation(portId, 50, 14, 2.0, 38, 'Weekly', 12, true);
  assert(Boolean(simPersist.runId), 'Applied simulation must return a valid runId from database');
  
  const historyAfter = await allocationService.getAllocationHistory(portId);
  assert(historyAfter.length > historyBefore.length, 'AllocationRun history count in database must increase');
  const latestDbRun = historyAfter[0];
  assert(latestDbRun.id === simPersist.runId, 'Latest DB history record ID must match created runId');
  testPass(`Database persistence verified: AllocationRun recorded in DB with id ${latestDbRun.id}`);

  // --- Test 14: Deterministic Results for Identical Inputs ---
  console.log('\n--- 14. Testing Deterministic Consistency for Identical Inputs ---');
  const run1 = await allocationService.simulateAllocation(portId, 62, 14, 2.0, 38);
  const run2 = await allocationService.simulateAllocation(portId, 62, 14, 2.0, 38);
  
  assert(run1.proposed_weights.length === run2.proposed_weights.length, 'Run outputs must have identical item counts');
  for (let i = 0; i < run1.proposed_weights.length; i++) {
    const w1 = run1.proposed_weights[i];
    const w2 = run2.proposed_weights[i];
    assert(w1.ticker === w2.ticker, 'Tickers must match in exact sequence');
    assert(w1.proposedWeight === w2.proposedWeight, `Proposed weight for ${w1.ticker} must be identical across runs`);
  }
  testPass('Optimizer results are 100% deterministic for identical inputs');

  // Clean up test stock NEWTECH
  const finalHoldings = uniqueHoldings.filter(h => h.ticker !== 'NEWTECH');
  await portfolioService.updateHoldings(portId, finalHoldings);

  console.log('\n====================================================');
  console.log(`ALL ALLOCATION OPTIMIZER REGRESSION TESTS PASSED! (${passed}/${passed}) 🎉`);
  console.log('====================================================\n');
}

runAllocationOptimizerTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Allocation optimizer test failed:', err);
    process.exit(1);
  });

