import axios from 'axios';
import { prisma } from '../src/server';

const API_URL = 'http://localhost:3000/api';

async function testBackend() {
  console.log('Testing APIs...');
  try {
    // POST /events/analyze (valid)
    const analyzeRes = await axios.post(`${API_URL}/events/analyze`, {
      text: "Tech stocks rally heavily after new semiconductor subsidies are announced.",
      source: "Test News",
      timestamp: new Date().toISOString()
    });
    console.log(`[POST /events/analyze] Created event ID: ${analyzeRes.data.id}`);
    console.log(`  Confidence Fields: Classification ${analyzeRes.data.classificationConfidence}, Sentiment ${analyzeRes.data.sentimentConfidence}, Impact ${analyzeRes.data.impactConfidence}`);
    console.log(`  Date/Time: ${analyzeRes.data.date} ${analyzeRes.data.time}`);

    const eventId = analyzeRes.data.id;

    // GET /events
    const eventsRes = await axios.get(`${API_URL}/events`);
    console.log(`[GET /events] Count: ${eventsRes.data.length}`);

    // GET /events/:id
    const eventRes = await axios.get(`${API_URL}/events/${eventId}`);
    const ev = eventRes.data;
    console.log(`[GET /events/:id] Title: ${ev.title}`);
    console.log(`  Confidence Fields: Classification ${ev.classificationConfidence}, Sentiment ${ev.sentimentConfidence}, Impact ${ev.impactConfidence}`);
    console.log(`  Impact Reason: ${ev.impactReason ? 'Present' : 'Missing'}`);
    console.log(`  Date/Time: ${ev.date} ${ev.time}`);

    // Filter events
    const filteredEventsRes = await axios.get(`${API_URL}/events?category=${encodeURIComponent(ev.category)}`);
    console.log(`[GET /events?category=...] Count: ${filteredEventsRes.data.length}`);
    
    // GET /portfolios
    const portfoliosRes = await axios.get(`${API_URL}/portfolios`);
    console.log(`[GET /portfolios] Count: ${portfoliosRes.data.length}, First ID: ${portfoliosRes.data[0].id}, Baseline: ${portfoliosRes.data[0].baselineValue}`);
    
    // Portfolio
    const portfolio = await prisma.portfolio.findFirst();
    const assetsRes = await axios.get(`${API_URL}/portfolio/${portfolio?.id}/assets`);
    console.log(`[GET /portfolio/:id/assets] Assets count: ${assetsRes.data.length}`);

    // GET /scenarios
    const scenariosRes = await axios.get(`${API_URL}/scenarios`);
    console.log(`[GET /scenarios] Count: ${scenariosRes.data.length}`);
    const scenarioId = scenariosRes.data[0].id;

    // Generate parameters
    const paramsRes = await axios.post(`${API_URL}/stress-tests/generate-parameters`, {
      event_id: eventId,
      scenario_id: scenarioId
    });
    console.log(`[POST /stress-tests/generate-parameters] Result rate: ${paramsRes.data.rate}`);

    // Allocation simulation
    const allocRes = await axios.post(`${API_URL}/allocations/simulate`, {
      portfolio_id: portfolio?.id,
      sensitivity: 62,
      maxWeight: 14,
      maxChange: 2
    });
    console.log(`[POST /allocations/simulate] Proposed weights count: ${allocRes.data.proposed_weights.length}`);

    // Run stress test
    const runRes = await axios.post(`${API_URL}/stress-tests/run`, {
      portfolio_id: portfolio?.id,
      scenario_id: scenarioId,
      event_id: eventId,
      parameters: paramsRes.data
    });
    console.log(`[POST /stress-tests/run] Absolute Loss: ${runRes.data.absolute_loss}, Risk Score: ${runRes.data.risk_score}`);
    const runId = runRes.data.run_id;

    // Get History
    const historyRes = await axios.get(`${API_URL}/stress-tests/history`);
    console.log(`[GET /stress-tests/history] Count: ${historyRes.data.length}`);

    // Get Run Detail
    const runDetailRes = await axios.get(`${API_URL}/stress-tests/${runId}`);
    console.log(`[GET /stress-tests/:id] Parameter rate used: ${runDetailRes.data.parameters_used.rate}`);

    console.log('All tests passed!');
  } catch (err: any) {
    console.error('Test failed:', err?.response?.data || err.message);
  }
}

testBackend();
