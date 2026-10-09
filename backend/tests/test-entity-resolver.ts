import { entityResolver } from '../src/services/ingestion/entity-resolver';
import { prisma } from '../src/db';
import assert from 'assert';

async function runUnitTests() {
  console.log('--- STARTING PHASE 3 ENTITY RESOLVER UNIT TESTS ---');

  // Fetch or seed Portfolio A
  const pA = await prisma.portfolio.findFirst({ include: { assets: true } });
  if (!pA) {
    throw new Error('No portfolio found in database for unit tests.');
  }
  const portfolioAId = pA.id;

  // Always create an isolated Portfolio B with non-overlapping assets for testing
  const pB = await prisma.portfolio.create({
    data: {
      name: `Isolation Test Portfolio B (${Date.now()})`,
      baseline_value: 1000,
      assets: {
        create: [
          { ticker: 'TSLA', company: 'Tesla Inc.', asset_type: 'EQUITY', sector: 'Consumer Cyclical', current_weight: 0.50, exposure_value: 500, sentiment: 0, base_sentiment: 0 },
          { ticker: 'AMZN', company: 'Amazon.com Inc.', asset_type: 'EQUITY', sector: 'Consumer Cyclical', current_weight: 0.50, exposure_value: 500, sentiment: 0, base_sentiment: 0 }
        ]
      }
    }
  });
  const portfolioBId = pB.id;

  // 1. Exact Ticker Match
  const res1 = await entityResolver.resolveEntities('AAPL shares surged 5% in heavy trading.', 'Stock Market Update', portfolioAId);
  assert.ok(res1.some(e => e.ticker === 'AAPL' && e.matchType === 'EXACT_TICKER'));
  console.log('[PASS] Test 1: Exact ticker match (AAPL)');

  // 2. Company Name Match
  const res2 = await entityResolver.resolveEntities('Microsoft Corp. announced new cloud enterprise contracts.', 'Cloud News', portfolioAId);
  assert.ok(res2.some(e => e.canonicalName === 'Microsoft Corp.'));
  console.log('[PASS] Test 2: Company name match (Microsoft Corp.)');

  // 3. Alias Match (Google -> GOOGL)
  const res3 = await entityResolver.resolveEntities('Google search revenue surpassed analyst predictions in Q3.', 'Tech Earnings', portfolioAId);
  assert.ok(res3.some(e => e.ticker === 'GOOGL' && e.matchType === 'ALIAS'));
  console.log('[PASS] Test 3: Alias match (Google -> GOOGL)');

  // 4. Alias Match (JPMorgan / Chase Bank -> JPM)
  const res4a = await entityResolver.resolveEntities('JPMorgan announced expansion of commercial loan syndication.', 'Bank Update', portfolioAId);
  assert.ok(res4a.some(e => e.ticker === 'JPM'));
  const res4b = await entityResolver.resolveEntities('Chase Bank opened 50 new branches in high-density metro markets.', 'Banking Expansion', portfolioAId);
  assert.ok(res4b.some(e => e.ticker === 'JPM'));
  console.log('[PASS] Test 4: Alias match (JPMorgan / Chase Bank -> JPM)');

  // 5. Central Bank Entity Match
  const res5 = await entityResolver.resolveEntities('The Federal Reserve voted to raise interest rates by 25bps.', 'Monetary Policy', portfolioAId);
  assert.ok(res5.some(e => e.canonicalName === 'Federal Reserve' && e.entityType === 'CENTRAL_BANK'));
  console.log('[PASS] Test 5: Central Bank entity match (Federal Reserve / Fed)');

  // 6. Macro Indicator Match
  const res6 = await entityResolver.resolveEntities('Annual CPI inflation accelerated unexpectedly to 3.8%.', 'Macro Report', portfolioAId);
  assert.ok(res6.some(e => e.canonicalName === 'Inflation' && e.entityType === 'MACRO_INDICATOR'));
  console.log('[PASS] Test 6: Macro indicator match (CPI / Inflation)');

  // 7. Short Ticker Safeguard
  const res7 = await entityResolver.resolveEntities('It was a sunny day in the city.', 'Weather Report', portfolioAId);
  assert.ok(!res7.some(e => e.ticker === 'IT'));
  console.log('[PASS] Test 7: Short ticker safeguard (IT false positive prevented)');

  // 8. Apple False Positive Exclusion
  const res8 = await entityResolver.resolveEntities('Local bakeries competed in the annual apple pie contest.', 'Pastry News', portfolioAId);
  assert.ok(!res8.some(e => e.ticker === 'AAPL'));
  console.log('[PASS] Test 8: Apple false positive language excluded (apple pie)');

  // 9. Portfolio Isolation (A vs B)
  const relA = await entityResolver.evaluatePortfolioRelevance('Apple Inc. reported record quarterly profits.', 'Apple News', portfolioAId);
  assert.strictEqual(relA.relevanceType, 'DIRECT');
  assert.ok(relA.affectedAssets.includes('AAPL'));

  const relB = await entityResolver.evaluatePortfolioRelevance('Apple Inc. reported record quarterly profits.', 'Apple News', portfolioBId);
  assert.strictEqual(relB.affectedAssets.includes('AAPL'), false);
  assert.notStrictEqual(relB.relevanceType, 'DIRECT');
  console.log('[PASS] Test 9: Portfolio A vs Portfolio B isolation check');

  // 10. Direct Relevance Evaluation
  const rel10 = await entityResolver.evaluatePortfolioRelevance('Microsoft Corp. signed a major government enterprise contract.', 'MSFT Contract', portfolioAId);
  assert.strictEqual(rel10.relevant, true);
  assert.strictEqual(rel10.relevanceType, 'DIRECT');
  assert.ok(rel10.affectedAssets.includes('MSFT'));
  console.log('[PASS] Test 10: Direct relevance evaluation');

  // 11. Indirect Relevance Evaluation
  const rel11 = await entityResolver.evaluatePortfolioRelevance('Global semiconductor industry sales projected to grow 20%.', 'Tech Sector Report', portfolioAId);
  assert.strictEqual(rel11.relevant, true);
  assert.strictEqual(rel11.relevanceType, 'INDIRECT');
  console.log('[PASS] Test 11: Indirect relevance evaluation');

  // 12. Portfolio-wide Relevance Evaluation
  const rel12 = await entityResolver.evaluatePortfolioRelevance('Federal Reserve raises interest rates amid persistent inflation.', 'Fed Rate Hike', portfolioAId);
  assert.strictEqual(rel12.relevant, true);
  assert.strictEqual(rel12.relevanceType, 'PORTFOLIO_WIDE');
  console.log('[PASS] Test 12: Portfolio-wide relevance evaluation');

  // 13. Irrelevant Article Evaluation
  const rel13 = await entityResolver.evaluatePortfolioRelevance('National park opens new hiking trail in mountain range.', 'Outdoors', portfolioAId);
  assert.strictEqual(rel13.relevant, false);
  assert.strictEqual(rel13.relevanceType, 'IRRELEVANT');
  assert.strictEqual(rel13.affectedAssets.length, 0);
  console.log('[PASS] Test 13: Irrelevant article evaluation');

  // 14. Multiple Entities Resolution
  const res14 = await entityResolver.resolveEntities('Apple Inc. and Microsoft Corp. announced joint cloud software integration.', 'Joint Venture', portfolioAId);
  const names14 = res14.map(e => e.canonicalName);
  assert.ok(names14.includes('Apple Inc.'));
  assert.ok(names14.includes('Microsoft Corp.'));
  console.log('[PASS] Test 14: Multiple entities resolution');

  // 15. Multiple Affected Assets Handling
  const rel15 = await entityResolver.evaluatePortfolioRelevance('Apple and Microsoft shares rallied following strong enterprise demand.', 'Tech Rally', portfolioAId);
  assert.ok(rel15.affectedAssets.includes('AAPL'));
  assert.ok(rel15.affectedAssets.includes('MSFT'));
  console.log('[PASS] Test 15: Multiple affected assets handling');

  // 16. Macro Asset-Type Mapping
  const rel16 = await entityResolver.evaluatePortfolioRelevance('Central bank rate hike increases borrowing costs across credit markets.', 'Central Bank Policy', portfolioAId);
  assert.strictEqual(rel16.relevanceType, 'PORTFOLIO_WIDE');
  assert.ok(rel16.affectedAssets.length > 0);
  console.log('[PASS] Test 16: Macro asset-type mapping');

  // 17. Deduplication of Affected Assets
  const rel17 = await entityResolver.evaluatePortfolioRelevance('AAPL, Apple, and Apple Inc. were featured in tech report.', 'Repeated Mention', portfolioAId);
  const count17 = rel17.affectedAssets.filter(a => a === 'AAPL').length;
  assert.strictEqual(count17, 1);
  console.log('[PASS] Test 17: Deduplication of affected assets');

  // 18. Relevance Score Bounding [0.0, 1.0]
  const rel18 = await entityResolver.evaluatePortfolioRelevance('Apple Inc. reported quarterly earnings.', 'Apple Report', portfolioAId);
  assert.ok(rel18.relevanceScore >= 0.0 && rel18.relevanceScore <= 1.0);
  console.log('[PASS] Test 18: Relevance score bounding [0.0, 1.0]');

  // 19. Ambiguous Match Rejection
  const rel19 = await entityResolver.evaluatePortfolioRelevance('Metabolic research paper examines target audience response.', 'Non-financial paper', portfolioAId);
  assert.strictEqual(rel19.relevanceType, 'IRRELEVANT');
  console.log('[PASS] Test 19: Ambiguous match rejection');

  // 20. No Invented Portfolio Assets Check
  const rel20 = await entityResolver.evaluatePortfolioRelevance('Tesla announced new electric vehicle manufacturing plant in Europe.', 'EV News', portfolioAId);
  assert.strictEqual(rel20.affectedAssets.includes('TSLA'), false);
  console.log('[PASS] Test 20: No invented portfolio assets check');

  console.log('\n--- ALL 20 ENTITY RESOLVER UNIT TESTS PASSED ---');
}

runUnitTests().catch(err => {
  console.error('\n--- UNIT TEST FAILED ---');
  console.error(err);
  process.exit(1);
});
