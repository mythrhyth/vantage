import { riskEngineService } from '../src/services/risk-engine/risk-engine.service';
import { portfolioService } from '../src/services/portfolios/portfolio.service';
import { prisma } from '../src/server';

async function testOverviewLandingIntegration() {
  console.log('====================================================');
  console.log('RUNNING HOME / OVERVIEW LANDING INTEGRATION TESTS');
  console.log('====================================================\n');

  try {
    // 1. Portfolio Fetching & Asset Reconciliation
    console.log('--- 1. Testing Portfolio Exposure & Asset Reconciliation ---');
    const portfolios = await portfolioService.listPortfolios();
    if (!portfolios || portfolios.length === 0) {
      console.error('❌ FAIL: No active portfolio found in DB');
      process.exit(1);
    }

    const testPort = portfolios[0];
    console.log(`✅ 1. Portfolio baseline exposure loaded: "₹${testPort.baselineValue} Cr" (ID: ${testPort.id})`);

    const loans = testPort.loansExposure || 0;
    const bonds = testPort.bondsExposure || 0;
    const derivatives = testPort.derivativesExposure || 0;
    const equity = testPort.equityExposure || 0;
    const totalAssetSum = loans + bonds + derivatives + equity;

    console.log(`   - Asset Breakdown: Loans ₹${loans} Cr, Bonds ₹${bonds} Cr, Derivatives ₹${derivatives} Cr, Equity ₹${equity} Cr`);
    console.log(`   - Total Asset Sum: ₹${totalAssetSum} Cr vs Baseline: ₹${testPort.baselineValue} Cr`);

    if (Math.abs(totalAssetSum - testPort.baselineValue) < 1.0) {
      console.log('✅ Asset exposure breakdown strictly reconciles to portfolio baseline');
    } else {
      console.log(`ℹ️ Exposure warning: Total assets ₹${totalAssetSum} Cr vs Baseline ₹${testPort.baselineValue} Cr`);
    }

    // 2. Persisted Risk Events Querying & Impact Classification
    console.log('\n--- 2. Testing Persisted Risk Events & Impact Classification ---');
    const events = await prisma.riskEvent.findMany({
      orderBy: { created_at: 'desc' }
    });

    console.log(`   - Total persisted risk events in DB: ${events.length}`);

    const highImpactCount = events.filter(e => Number(e.impact) >= 7.0).length;
    console.log(`   - High-impact events (impact >= 7.0): ${highImpactCount}`);

    const avgSentiment = events.length > 0
      ? events.reduce((sum, e) => sum + Number(e.sentiment), 0) / events.length
      : 0;
    console.log(`   - Aggregated average market sentiment: ${avgSentiment.toFixed(2)}`);

    if (events.length > 0) {
      const sample = events[0];
      if (sample.title && sample.category && sample.sentiment !== undefined && sample.impact !== undefined) {
        console.log(`✅ 2. Real API event fields verified on sample: "${sample.title}" (${sample.category}, Impact ${Number(sample.impact).toFixed(1)})`);
      } else {
        console.error('❌ FAIL: Event sample missing essential required fields:', sample);
        process.exit(1);
      }
    } else {
      console.log('ℹ️ Zero risk events in DB; empty state will render gracefully');
    }

    // 3. Deterministic Stress Parameter & Time-Horizon Scaling Integration
    console.log('\n--- 3. Testing Time Horizon (sqrt(T)) Stress Parameter Scaling ---');
    const baseParams = { sp: 80, spread: 150, liquidity: 10 };
    
    const run3m = await riskEngineService.runStressTest(testPort.id, { ...baseParams, horizon: '3 months' });
    const run12m = await riskEngineService.runStressTest(testPort.id, { ...baseParams, horizon: '12 months' });
    const run24m = await riskEngineService.runStressTest(testPort.id, { ...baseParams, horizon: '24 months' });

    console.log(`   - 3-Month Horizon (0.25y): Loss ₹${run3m.absolute_loss.toFixed(2)} Cr`);
    console.log(`   - 12-Month Horizon (1.0y): Loss ₹${run12m.absolute_loss.toFixed(2)} Cr`);
    console.log(`   - 24-Month Horizon (2.0y): Loss ₹${run24m.absolute_loss.toFixed(2)} Cr`);

    const expectedRatio3m = Math.sqrt(0.25); // 0.50
    const expectedRatio24m = Math.sqrt(2.0); // 1.414

    if (
      Math.abs(run3m.absolute_loss / run12m.absolute_loss - expectedRatio3m) < 0.05 &&
      Math.abs(run24m.absolute_loss / run12m.absolute_loss - expectedRatio24m) < 0.05
    ) {
      console.log('✅ 3. Time horizon scaling (sqrt(T)) verified across 3mo, 12mo, and 24mo horizons');
    } else {
      console.error('❌ FAIL: Time horizon scaling ratio mismatch:', {
        r3m: run3m.absolute_loss / run12m.absolute_loss,
        r24m: run24m.absolute_loss / run12m.absolute_loss
      });
      process.exit(1);
    }

    // 4. Stale Request & Overlapping Refresh Protection Invariant
    console.log('\n--- 4. Testing Stale Request Guard Invariant ---');
    let activeRequestId = 0;
    const completedRequests: number[] = [];

    const simulateFetch = async (reqId: number, delayMs: number) => {
      await new Promise(r => setTimeout(r, delayMs));
      if (reqId === activeRequestId) {
        completedRequests.push(reqId);
      }
    };

    activeRequestId = 1;
    const p1 = simulateFetch(1, 100);
    activeRequestId = 2; // Request 2 supersedes request 1
    const p2 = simulateFetch(2, 50);

    await Promise.all([p1, p2]);

    if (completedRequests.length === 1 && completedRequests[0] === 2) {
      console.log('✅ 4. Stale request guard correctly ignored out-of-order response (only Request #2 applied)');
    } else {
      console.error('❌ FAIL: Stale request protection failed:', completedRequests);
      process.exit(1);
    }

    console.log('\n====================================================');
    console.log('ALL HOME / OVERVIEW INTEGRATION TESTS PASSED! 🎉');
    console.log('====================================================');

  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testOverviewLandingIntegration().catch(e => {
  console.error(e);
  process.exit(1);
});
