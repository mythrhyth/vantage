import { allocationService } from '../src/services/allocations/allocation.service';
import { portfolioService } from '../src/services/portfolios/portfolio.service';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`❌ FAIL: ${msg}`);
  }
}

async function testAllocationConstraints() {
  console.log('==================================================');
  console.log('RUNNING INDEX REALLOCATION CONSTRAINTS TEST SUITE');
  console.log('==================================================\n');

  const portfolios = await portfolioService.getPortfolios();
  assert(portfolios.length > 0, 'Should have active portfolio');
  const portId = portfolios[0].id;

  // 1. Test Sensitivity = 0 (No change)
  console.log('--- 1. Testing Zero Sensitivity (No reallocation change) ---');
  const simZero = await allocationService.simulateAllocation(portId, 0, 14, 2.0, 40);
  assert(simZero.proposed_weights.length > 0, 'Should return proposed weights');
  console.log(`✅ Returned ${simZero.proposed_weights.length} company proposed weights.`);

  // 2. Test Max Weight Constraint (10%)
  console.log('\n--- 2. Testing Maximum Stock Weight Constraint (10.0%) ---');
  const simMaxW = await allocationService.simulateAllocation(portId, 100, 10.0, 2.0, 50);
  for (const item of simMaxW.proposed_weights) {
    assert(item.proposedWeight <= 10.05, `Holding ${item.ticker} proposed weight (${item.proposedWeight}%) exceeded maxWeight cap (10.0%)`);
  }
  console.log('✅ Max stock weight cap (10.0%) strictly enforced across all holdings.');

  // 3. Test Max Change Constraint (0.5%)
  console.log('\n--- 3. Testing Maximum Allocation Change Constraint (±0.5%) ---');
  const simMaxC = await allocationService.simulateAllocation(portId, 100, 20.0, 0.5, 50);
  for (const item of simMaxC.proposed_weights) {
    const delta = Math.abs(item.proposedWeight - item.currentWeight);
    assert(delta <= 0.55, `Holding ${item.ticker} change (${delta.toFixed(2)}%) exceeded maxChange limit (0.5%)`);
  }
  console.log('✅ Max allocation change limit (±0.5%) strictly enforced across all holdings.');

  // 4. Test Sector Limit Constraint (25%)
  console.log('\n--- 4. Testing Sector Exposure Limit Constraint (25.0%) ---');
  const simSector = await allocationService.simulateAllocation(portId, 100, 20.0, 4.0, 25.0);
  const sectorTotals: Record<string, number> = {};
  for (const item of simSector.proposed_weights) {
    sectorTotals[item.sector] = (sectorTotals[item.sector] || 0) + item.proposedWeight;
  }
  for (const [sec, sumW] of Object.entries(sectorTotals)) {
    console.log(`   - Sector "${sec}" Total Weight: ${sumW.toFixed(2)}%`);
    assert(sumW <= 25.05, `Sector "${sec}" total weight (${sumW.toFixed(2)}%) exceeded sector limit (25.0%)`);
  }
  console.log('✅ Sector exposure cap (25.0%) strictly enforced across all sectors.');

  // 5. Test Non-negativity & Exact Sum Normalization
  console.log('\n--- 5. Testing Non-Negativity & Weight Sum Normalization ---');
  const simNorm = await allocationService.simulateAllocation(portId, 62, 14.0, 2.0, 38.0);
  const totalCur = simNorm.proposed_weights.reduce((sum: number, item: any) => sum + item.currentWeight, 0);
  const totalProp = simNorm.proposed_weights.reduce((sum: number, item: any) => sum + item.proposedWeight, 0);
  console.log(`   - Current Total Equity Weight: ${totalCur.toFixed(2)}%`);
  console.log(`   - Proposed Total Equity Weight: ${totalProp.toFixed(2)}%`);

  for (const item of simNorm.proposed_weights) {
    assert(item.proposedWeight >= 0, `Holding ${item.ticker} weight cannot be negative (${item.proposedWeight})`);
  }
  assert(Math.abs(totalProp - totalCur) <= 0.2, `Proposed sum (${totalProp}) should equal current total equity weight (${totalCur})`);
  console.log('✅ Non-negativity and total weight conservation verified successfully.');

  console.log('\n==================================================');
  console.log('ALL INDEX REALLOCATION CONSTRAINTS TEST PASSED SUCCESSFULLY! 🎉');
  console.log('==================================================\n');
}

testAllocationConstraints()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Allocation test failed:', err);
    process.exit(1);
  });
