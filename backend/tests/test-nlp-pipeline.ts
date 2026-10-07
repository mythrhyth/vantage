import axios from 'axios';
import { prisma } from '../src/server';
import { NlpService } from '../src/services/nlp/nlp.service';
import { NlpValidationException } from '../src/services/nlp/nlp.exception';

const API_URL = 'http://localhost:3000/api';

async function runTests() {
  console.log('--- NLP PIPELINE VERIFICATION ---');

  // Test 1: Missing Text
  try {
    await axios.post(`${API_URL}/events/analyze`, {});
    console.log('[FAIL] Missing text should have returned 400.');
  } catch (e: any) {
    if (e.response?.status === 400) console.log('[PASS] Missing text returned 400.');
    else console.log(`[FAIL] Missing text returned ${e.response?.status}`);
  }

  // Test 2: Empty Text
  try {
    await axios.post(`${API_URL}/events/analyze`, { text: '' });
    console.log('[FAIL] Empty text should have returned 400.');
  } catch (e: any) {
    if (e.response?.status === 400) console.log('[PASS] Empty text returned 400.');
    else console.log(`[FAIL] Empty text returned ${e.response?.status}`);
  }

  // Test 3: Whitespace Text
  try {
    await axios.post(`${API_URL}/events/analyze`, { text: '   ' });
    console.log('[FAIL] Whitespace text should have returned 400.');
  } catch (e: any) {
    if (e.response?.status === 400) console.log('[PASS] Whitespace text returned 400.');
    else console.log(`[FAIL] Whitespace text returned ${e.response?.status}`);
  }

  // Test 4: Missing Source
  try {
    const res = await axios.post(`${API_URL}/events/analyze`, { text: 'Valid test text without source' });
    if (res.status === 200 || res.status === 201) console.log('[PASS] Missing source is handled properly (optional or defaulted).');
    else console.log(`[FAIL] Missing source returned ${res.status}`);
  } catch (e: any) {
    console.log(`[FAIL] Missing source caused error: ${e.message}`);
  }

  // Test NLP Service Output Validation manually
  console.log('\n--- NLP OUTPUT VALIDATION ---');
  const service = new NlpService();
  
  const invalidTests = [
    { name: 'Sentiment = -1.5', overrides: { sentiment: -1.5 } },
    { name: 'Sentiment = 1.5', overrides: { sentiment: 1.5 } },
    { name: 'Impact = -1', overrides: { impact: -1 } },
    { name: 'Impact = 11', overrides: { impact: 11 } },
    { name: 'SentimentConfidence = -0.1', overrides: { sentimentConfidence: -0.1 } },
    { name: 'SentimentConfidence = 1.1', overrides: { sentimentConfidence: 1.1 } },
    { name: 'ImpactConfidence = -0.1', overrides: { impactConfidence: -0.1 } },
    { name: 'ImpactConfidence = 1.1', overrides: { impactConfidence: 1.1 } },
    { name: 'Invalid Category', overrides: { classification: 'Nonexistent Category' } },
  ];

  for (const t of invalidTests) {
    try {
      (service as any).validateAnalysis({
        title: 'Test',
        entity: 'Test',
        classification: 'Sector outlook',
        sentiment: 0,
        sentimentConfidence: 0.5,
        impact: 5,
        impactConfidence: 0.5,
        signals: [],
        sentimentDrivers: [],
        impactFactors: [],
        affectedAreas: [],
        riskFlow: [],
        source: 'Test',
        ...t.overrides
      });
      console.log(`[FAIL] ${t.name} should throw NlpValidationException`);
    } catch (e: any) {
      if (e?.name === 'NlpValidationException') console.log(`[PASS] ${t.name} rejected.`);
      else console.log(`[FAIL] ${t.name} threw unknown error: ${e.message}`);
    }
  }

  // Test Downstream Integration
  console.log('\n--- NLP TO STRESS TEST END-TO-END ---');
  try {
    // 1. Analyze Event
    const analyzeRes = await axios.post(`${API_URL}/events/analyze`, {
      text: "Federal Reserve officials indicated that interest rates may remain elevated for longer as inflation remains persistent.",
      source: "Test Financial News"
    });
    const newEvent = analyzeRes.data;
    console.log(`[PASS] Event Analyzed. ID: ${newEvent.id}`);

    // 2. Verify Persistence in DB
    const dbEvent = await prisma.riskEvent.findUnique({ where: { id: newEvent.id } });
    if (dbEvent) {
      console.log(`[PASS] Event exists in DB. Sentiment: ${dbEvent.sentiment}, Impact: ${dbEvent.impact}`);
    } else {
      console.log(`[FAIL] Event not found in DB or malformed.`);
    }

    // 3. Get Scenarios & Portfolio
    const scenariosRes = await axios.get(`${API_URL}/scenarios`);
    const scenarioId = scenariosRes.data[0].id;

    const portfoliosRes = await axios.get(`${API_URL}/portfolios`);
    const portfolioId = portfoliosRes.data[0].id;

    // 4. Generate Parameters
    const paramsRes = await axios.post(`${API_URL}/stress-tests/generate-parameters`, {
      event_id: newEvent.id,
      scenario_id: scenarioId
    });
    console.log(`[PASS] Generated Parameters. Rate: ${paramsRes.data.rate}`);

    // 5. Run Stress Test
    const runRes = await axios.post(`${API_URL}/stress-tests/run`, {
      portfolio_id: portfolioId,
      scenario_id: scenarioId,
      event_id: newEvent.id,
      parameters: paramsRes.data
    });
    console.log(`[PASS] Stress Test Run. Run ID: ${runRes.data.run_id}, Absolute Loss: ${runRes.data.absolute_loss}`);

    // 6. Check History
    const runHistory = await prisma.stressTestRun.findUnique({ where: { id: runRes.data.run_id } });
    if (runHistory) {
      console.log(`[PASS] Stress Test Run persisted in DB.`);
    } else {
      console.log(`[FAIL] Stress Test Run not in DB.`);
    }
  } catch (e: any) {
    console.log(`[FAIL] Pipeline integration failed: ${e.message}`);
  }

  console.log('\nAll custom tests completed.');
}

runTests().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
