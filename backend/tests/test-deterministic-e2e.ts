import { prisma } from '../src/db';
import { nlpService } from '../src/providers/nlp/nlp.service';
import { scenarioService } from '../src/services/scenarios/scenario.service';
import { riskEngineService } from '../src/services/risk-engine/risk-engine.service';
import { portfolioService } from '../src/services/portfolios/portfolio.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runE2EDeterministicTest() {
  console.log('====================================================');
  console.log('RUNNING DETERMINISTIC E2E & REAL DATABASE TEST');
  console.log('====================================================\n');

  // Ensure portfolio exists in DB
  const portfolios = await portfolioService.getPortfolios();
  assert(portfolios.length > 0, 'No portfolio found in DB');
  const mainPort = portfolios[0];
  console.log(`[DB Test] Main Portfolio: "${mainPort.name}", Baseline Value: ₹${mainPort.baselineValue} Cr`);

  // 1. Analyze and persist a Monetary Policy Event
  console.log('\n--- Step 1: Ingesting Monetary Policy Event via NlpService ---');
  const event1Text = 'The Federal Reserve announced an aggressive 50 basis point rate hike to curb persistent inflationary pressures. Benchmark yields surged across sovereign bond markets.';
  const event1 = await nlpService.analyzeAndPersist(
    { title: 'Fed Raises Rates by 50 bps', source: 'Reuters Test' },
    event1Text,
    { relevanceType: 'PORTFOLIO_WIDE', relevanceScore: 1.0, affectedAssets: [] }
  );

  console.log(`[DB Test] Created RiskEvent ID: ${event1.id}`);
  console.log(`[DB Test] Category (Phase 2): "${event1.category}"`);
  console.log(`[DB Test] Sentiment (FinBERT): ${event1.sentiment}`);
  console.log(`[DB Test] Deterministic Impact: ${event1.impact}/10`);
  assert(event1.category === 'Monetary policy', `Expected Monetary policy, got ${event1.category}`);
  assert(Number(event1.impact) > 1.0, `Expected impact > 1.0, got ${event1.impact}`);

  // 2. Generate Deterministic Stress Parameters via ScenarioService
  console.log('\n--- Step 2: Generating Deterministic Stress Parameters ---');
  const params1 = await scenarioService.generateEventStressParameters(event1.id);
  console.log('[DB Test] Deterministic Parameters Generated:', params1);
  assert(params1.rate > 0, 'Rate shock should be positive for Fed rate hike');
  assert(params1.spread > 0, 'Spread shock should be positive');

  // 3. Execute Stress Test via RiskEngineService & Persist in PostgreSQL
  console.log('\n--- Step 3: Executing Stress Test in RiskEngineService ---');
  const run1 = await riskEngineService.runStressTest(mainPort.id, params1, undefined, event1.id);
  console.log(`[DB Test] Stress Test Run ID: ${run1.id}`);
  console.log(`[DB Test] Absolute Loss: ₹${run1.absolute_loss.toFixed(2)} Cr`);
  console.log(`[DB Test] Risk Score: ${run1.risk_score} / 100`);
  console.log('[DB Test] Attribution Result:', run1.attribution_result);

  assert(run1.absolute_loss > 0, 'Expected positive loss for portfolio under rate hike');
  assert(run1.attribution_result !== null, 'Attribution result missing');

  // 4. Test Zero Exposure IRRELEVANT Event
  console.log('\n--- Step 4: Testing Zero-Exposure IRRELEVANT Event Safety ---');
  const event2 = await nlpService.analyzeAndPersist(
    { title: 'Severe Drought Affects Agricultural Crops', source: 'AgriNews Test' },
    'Extreme drought across South America threatens soy and wheat crop yields.',
    { relevanceType: 'IRRELEVANT', relevanceScore: 0.0, affectedAssets: [] }
  );

  console.log(`[DB Test] Irrelevant RiskEvent ID: ${event2.id}, Impact: ${event2.impact}`);
  assert(Number(event2.impact) === 1.0, `Expected Irrelevant Impact=1.0, got ${event2.impact}`);

  const params2 = await scenarioService.generateEventStressParameters(event2.id);
  console.log('[DB Test] Irrelevant Event Parameters:', params2);
  assert(params2.rate === 0 && params2.spread === 0 && params2.liquidity === 0 && params2.inflation === 0, 'Irrelevant event generated non-zero shocks!');

  const run2 = await riskEngineService.runStressTest(mainPort.id, params2, undefined, event2.id);
  console.log(`[DB Test] Irrelevant Stress Test Absolute Loss: ₹${run2.absolute_loss.toFixed(2)} Cr`);
  assert(run2.absolute_loss === 0, `Expected ₹0 loss for zero exposure, got ₹${run2.absolute_loss}`);

  // 5. Database Query Verification
  console.log('\n--- Step 5: Verifying PostgreSQL Records ---');
  const dbRun1 = await prisma.stressTestRun.findUnique({ where: { id: run1.id } });
  assert(dbRun1 !== null, 'StressTestRun not found in DB');
  assert(Number(dbRun1!.absolute_loss) === run1.absolute_loss, 'DB loss mismatch');
  console.log('[DB Test] Database record verified successfully!');

  console.log('\n====================================================');
  console.log('REAL DATABASE & E2E INTEGRATION TEST PASSED SUCCESSFULLY');
  console.log('====================================================\n');
}

runE2EDeterministicTest().catch(err => {
  console.error('Fatal error during E2E test run:', err);
  process.exit(1);
});
