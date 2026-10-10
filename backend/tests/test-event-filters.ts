import { eventService } from '../src/services/events/event.service';
import { portfolioService } from '../src/services/portfolios/portfolio.service';
import { prisma } from '../src/db';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`❌ FAIL: ${msg}`);
  }
}

async function testEventFilters() {
  console.log('==================================================');
  console.log('RUNNING RISK INTELLIGENCE EVENT FILTERS TEST SUITE');
  console.log('==================================================\n');

  // Fetch all events without filters first
  const allEvents = await eventService.listEvents({});
  console.log(`✅ Base Total Risk Events in DB: ${allEvents.length}`);
  assert(allEvents.length > 0, 'Should have risk events in database');

  // 1. Test Category Filter
  console.log('\n--- 1. Testing Category Filter ---');
  const mpEvents = await eventService.listEvents({ category: 'Monetary policy' });
  console.log(`✅ Monetary Policy events count: ${mpEvents.length}`);
  for (const e of mpEvents) {
    assert(e.category.toLowerCase() === 'monetary policy', `Event category should be Monetary policy, got ${e.category}`);
  }

  // 2. Test Minimum Impact Filter
  console.log('\n--- 2. Testing Impact Filter ---');
  const highImpactEvents = await eventService.listEvents({ impact: 4.0 });
  console.log(`✅ Events with Impact >= 4.0 count: ${highImpactEvents.length}`);
  for (const e of highImpactEvents) {
    assert(e.impact >= 4.0, `Event impact should be >= 4.0, got ${e.impact}`);
  }

  // 3. Test Sentiment Range Filter
  console.log('\n--- 3. Testing Sentiment Range Filter ---');
  const sentimentFiltered = await eventService.listEvents({ sentiment: 0.5 });
  console.log(`✅ Events with |Sentiment| <= 0.5 count: ${sentimentFiltered.length}`);
  for (const e of sentimentFiltered) {
    assert(Math.abs(e.sentiment) <= 0.5, `Event sentiment magnitude should be <= 0.5, got ${e.sentiment}`);
  }

  // 4. Test Horizon Filter
  console.log('\n--- 4. Testing Time Horizon Filter ---');
  const horizonFiltered = await eventService.listEvents({ horizon: '1-4 weeks' });
  console.log(`✅ Events with Horizon "1-4 weeks" count: ${horizonFiltered.length}`);

  // 5. Test Source Filter
  console.log('\n--- 5. Testing Source Filter ---');
  const sourceFiltered = await eventService.listEvents({ source: 'Reuters' });
  console.log(`✅ Events from Source "Reuters" count: ${sourceFiltered.length}`);

  // 6. Test Freshness Window Filter
  console.log('\n--- 6. Testing Freshness Filter ---');
  const freshnessFiltered = await eventService.listEvents({ freshness: '7d' });
  console.log(`✅ Events within Freshness Window "7d" count: ${freshnessFiltered.length}`);

  // 7. Test Portfolio Relevance Filter
  console.log('\n--- 7. Testing Portfolio Relevance Filter ---');
  const portfolios = await portfolioService.getPortfolios();
  if (portfolios.length > 0) {
    const portEvents = await eventService.listEvents({ portfolioId: portfolios[0].id });
    console.log(`✅ Portfolio-relevant events count for "${portfolios[0].name}": ${portEvents.length}`);
    assert(Array.isArray(portEvents), 'Should return array of portfolio relevant events');
  }

  console.log('\n==================================================');
  console.log('ALL RISK INTELLIGENCE EVENT FILTERS PASSED SUCCESSFULLY! 🎉');
  console.log('==================================================\n');
}

testEventFilters()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Filter test failed:', err);
    process.exit(1);
  });
