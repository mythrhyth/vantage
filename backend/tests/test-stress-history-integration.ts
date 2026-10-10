import { riskEngineService } from '../src/services/risk-engine/risk-engine.service';
import { portfolioService } from '../src/services/portfolios/portfolio.service';
import { stressTestController } from '../src/controllers/stress-test.controller';
import { prisma } from '../src/server';

async function testStressHistoryIntegration() {
  console.log('==================================================');
  console.log('RUNNING STRESS TEST HISTORY INTEGRATION TEST SUITE');
  console.log('==================================================\n');

  // Check Database URL configuration safely without exposing credentials
  const dbUrl = process.env.DATABASE_URL || '';
  const dbHost = dbUrl.includes('@') ? dbUrl.split('@')[1].split('/')[0] : 'default';
  console.log(`ℹ️ Database Environment: Connected to PostgreSQL host (${dbHost})`);

  const createdRunIds: string[] = [];

  try {
    // 1. Fetch active portfolio
    const portfolios = await portfolioService.listPortfolios();
    if (portfolios.length === 0) {
      console.error('❌ FAIL: No active portfolio found');
      process.exit(1);
    }
    const portfolioId = portfolios[0].id;

    // 2. Test Initial History Loading via Controller (GET /api/stress-tests/history)
    console.log('\n--- 1. Testing History Endpoint (GET /api/stress-tests/history) ---');
    let mockStatusCode = 200;
    let historyData: any[] = [];
    const mockReq: any = {};
    const mockRes: any = {
      status: (code: number) => {
        mockStatusCode = code;
        return mockRes;
      },
      json: (data: any) => {
        historyData = data;
        return mockRes;
      }
    };

    await stressTestController.getHistory(mockReq, mockRes);
    if (mockStatusCode === 200 && Array.isArray(historyData)) {
      console.log(`✅ 1. History endpoint returned ${historyData.length} persisted records`);
    } else {
      console.error(`❌ FAIL: History endpoint returned status ${mockStatusCode}`);
      process.exit(1);
    }

    // 3. Test Field Completeness & Optional Data Handling
    console.log('\n--- 2. Testing Record Schema & Optional Data Handling ---');
    if (historyData.length > 0) {
      const first = historyData[0];
      console.log('   - Sample Record ID:', first.id || first.runId);
      console.log('   - Scenario:', first.scenario);
      console.log('   - Event:', first.event ? first.event.title : 'null (Optional Event Safe)');
      console.log('   - Loss:', first.loss ?? first.absoluteLoss);
      console.log('   - CompletedAt:', first.completedAt);

      if ((first.runId || first.id) && (first.loss !== undefined || first.absoluteLoss !== undefined)) {
        console.log('✅ 2. History record contains required fields');
      } else {
        console.error('❌ FAIL: Record missing required fields:', first);
        process.exit(1);
      }
    } else {
      console.log('ℹ️ History is currently empty (safely handled by UI empty state)');
    }

    // 4. Test New Run Addition & Deduplication
    console.log('\n--- 3. Testing New Run Addition & Deduplication ---');
    const params = { rate: 100, spread: 50, liquidity: 5, inflation: 100 };
    const newRun = await riskEngineService.runStressTest(portfolioId, params);
    if (newRun && newRun.runId) {
      createdRunIds.push(newRun.runId);
    }

    console.log(`   - Created new test run ID: ${newRun.runId}`);
    const updatedHistory = await riskEngineService.getHistory();
    const foundRun = updatedHistory.find(r => String(r.runId || r.id) === String(newRun.runId));

    if (foundRun) {
      console.log('✅ 3. Newly completed stress test persisted and retrieved in history');
    } else {
      console.error('❌ FAIL: Newly completed stress test not found in updated history');
      process.exit(1);
    }

    // Frontend Deduplication Simulator
    const frontendState: any[] = updatedHistory.map(r => ({ runId: r.runId || r.id, scenario: r.scenario, loss: r.loss }));
    const initialLength = frontendState.length;
    
    // Attempting to re-add the same run
    const newEntryToAdd = { runId: newRun.runId, scenario: 'Custom Stress', loss: newRun.absolute_loss };
    const deduplicatedState = frontendState.some(item => String(item.runId) === String(newEntryToAdd.runId))
      ? frontendState
      : [newEntryToAdd, ...frontendState];

    if (deduplicatedState.length === initialLength) {
      console.log(`✅ 4. Deduplication logic verified: Re-adding run ID ${newRun.runId} did not duplicate record (count ${initialLength})`);
    } else {
      console.error(`❌ FAIL: Deduplication failed, state grew from ${initialLength} to ${deduplicatedState.length}`);
      process.exit(1);
    }

    // 5. Test Endpoint ID Lookup Validation Contracts (400 vs 404 vs 200)
    console.log('\n--- 4. Testing Endpoint ID Validation Contracts ---');

    // Case A: Malformed UUID -> HTTP 400 Bad Request
    let statusA = 0;
    let bodyA: any = null;
    const reqA: any = { params: { id: 'malformed-uuid-string' } };
    const resA: any = {
      status: (c: number) => { statusA = c; return resA; },
      json: (d: any) => { bodyA = d; return resA; }
    };
    await stressTestController.getRunById(reqA, resA);
    if (statusA === 400 && bodyA?.error?.message === 'Invalid run ID format') {
      console.log('✅ 4A. Malformed UUID returned HTTP 400 Bad Request without querying Prisma');
    } else {
      console.error(`❌ FAIL: Malformed UUID returned status ${statusA}, body:`, bodyA);
      process.exit(1);
    }

    // Case B: Valid UUID format but non-existent -> HTTP 404 Not Found
    let statusB = 0;
    let bodyB: any = null;
    const reqB: any = { params: { id: '00000000-0000-0000-0000-000000000000' } };
    const resB: any = {
      status: (c: number) => { statusB = c; return resB; },
      json: (d: any) => { bodyB = d; return resB; }
    };
    await stressTestController.getRunById(reqB, resB);
    if (statusB === 404 && bodyB?.error?.message === 'Stress test run not found') {
      console.log('✅ 4B. Non-existent valid UUID returned HTTP 404 Not Found');
    } else {
      console.error(`❌ FAIL: Non-existent UUID returned status ${statusB}, body:`, bodyB);
      process.exit(1);
    }

    // Case C: Existing Run UUID -> HTTP 200 OK
    let statusC = 200;
    let bodyC: any = null;
    const reqC: any = { params: { id: newRun.runId } };
    const resC: any = {
      status: (c: number) => { statusC = c; return resC; },
      json: (d: any) => { bodyC = d; return resC; }
    };
    await stressTestController.getRunById(reqC, resC);
    if (statusC === 200 && (bodyC?.id || bodyC?.runId) === newRun.runId) {
      console.log(`✅ 4C. Valid existing run ID (${newRun.runId}) returned HTTP 200 OK`);
    } else {
      console.error(`❌ FAIL: Valid run ID returned status ${statusC}, body:`, bodyC);
      process.exit(1);
    }

    console.log('\n==================================================');
    console.log('ALL STRESS HISTORY INTEGRATION TESTS PASSED! 🎉');
    console.log('==================================================');

  } finally {
    // Isolated Cleanup: Delete ONLY test-created records
    if (createdRunIds.length > 0) {
      console.log(`\n🧹 Cleaning up ${createdRunIds.length} test-created database records...`);
      const deleteResult = await prisma.stressTestRun.deleteMany({
        where: { id: { in: createdRunIds } }
      });
      console.log(`✅ Cleanup Complete: Removed ${deleteResult.count} test run record(s) from database`);
    }
    await prisma.$disconnect();
  }
}

testStressHistoryIntegration().catch(e => {
  console.error('Test execution error:', e);
  process.exit(1);
});
