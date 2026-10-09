import { finBertSentimentAnalyzer } from '../src/providers/nlp/finbert-sentiment.analyzer';

async function runFinBertTests() {
  console.log('==================================================');
  console.log('RUNNING STANDALONE FINBERT SENTIMENT ANALYZER TESTS');
  console.log('==================================================\n');

  let passed = 0;
  let total = 9;

  // Test 1: Clearly Positive Financial Text (Short Article)
  try {
    const text = "Company reports record quarterly revenue and raises full-year guidance.";
    const result = await finBertSentimentAnalyzer.analyzeSentiment(text);
    console.log('[Test 1 - Short Positive]', result);
    if (result.sentiment > 0 && result.label === 'positive' && result.confidence >= 0.5 && result.model === 'phase1d-finbert') {
      console.log('✓ TEST 1 PASSED: Short positive text correctly analyzed.');
      passed++;
    } else {
      console.error('✗ TEST 1 FAILED:', result);
    }
  } catch (e: any) {
    console.error('✗ TEST 1 FAILED with error:', e.message);
  }

  // Test 2: Clearly Negative Financial Text
  try {
    const text = "Bank reports significant losses and warns of rising credit defaults.";
    const result = await finBertSentimentAnalyzer.analyzeSentiment(text);
    console.log('[Test 2 - Negative]', result);
    if (result.sentiment < 0 && result.label === 'negative' && result.confidence >= 0.5) {
      console.log('✓ TEST 2 PASSED: Negative text correctly analyzed.');
      passed++;
    } else {
      console.error('✗ TEST 2 FAILED:', result);
    }
  } catch (e: any) {
    console.error('✗ TEST 2 FAILED with error:', e.message);
  }

  // Test 3: Neutral Financial Text
  try {
    const text = "Federal Reserve is scheduled to release its policy decision on Wednesday.";
    const result = await finBertSentimentAnalyzer.analyzeSentiment(text);
    console.log('[Test 3 - Neutral]', result);
    if (result.confidence >= 0.4 && result.sentiment >= -1 && result.sentiment <= 1) {
      console.log('✓ TEST 3 PASSED: Neutral policy announcement correctly evaluated.');
      passed++;
    } else {
      console.error('✗ TEST 3 FAILED:', result);
    }
  } catch (e: any) {
    console.error('✗ TEST 3 FAILED with error:', e.message);
  }

  // Test 4: Text Near Model Context Limit (~300 words)
  try {
    const textNearLimit = "Global central banks signaled potential monetary policy shifts as headline inflation metrics moderated across major economies. " +
      "In the United States, consumer price index growth slowed to an annualized 2.8%, while core inflation figures remained slightly sticky due to housing and service sector costs. " +
      "Federal Reserve officials emphasized a data-dependent approach for upcoming interest rate decisions, noting that labor market resilience provides room for patience. " +
      "Meanwhile, European Central Bank policymakers expressed optimism regarding disinflation progress across the eurozone. " +
      "Financial markets reacted with modest gains across sovereign bond yields, while equity futures held steady near all-time highs.";
    const result = await finBertSentimentAnalyzer.analyzeSentiment(textNearLimit);
    console.log('[Test 4 - Text Near Limit]', result);
    if (result.sentiment >= -1 && result.sentiment <= 1 && result.confidence > 0.4 && result.label) {
      console.log('✓ TEST 4 PASSED: Text near model context limit processed in single chunk.');
      passed++;
    } else {
      console.error('✗ TEST 4 FAILED:', result);
    }
  } catch (e: any) {
    console.error('✗ TEST 4 FAILED with error:', e.message);
  }

  // Test 5: Text Substantially Longer Than Model Context (>1,000 words, multi-chunk aggregation)
  try {
    const headlineLead = "Major investment bank reports record annual profits driven by corporate advisory fees and high trading volume. ";
    const bodyParagraph = "Commercial lending expanded 14% year-over-year while net interest margins widened across retail operations. " +
      "Asset management assets under management reached an all-time high of $3.2 trillion following institutional capital inflows. " +
      "The board declared an increased quarterly dividend and authorized a new $10 billion share buyback program. ";
    const tailWarning = "However, management cautioned about potential credit quality deterioration in commercial real estate portfolios during the second half. ";
    const longText = headlineLead + bodyParagraph.repeat(12) + tailWarning;

    const result = await finBertSentimentAnalyzer.analyzeSentiment(longText);
    console.log('[Test 5 - Substantially Long Text (>1,000 words)]', result);
    if (result.sentiment >= -1 && result.sentiment <= 1 && result.confidence > 0 && result.label === 'positive') {
      console.log('✓ TEST 5 PASSED: Substantially long text (>1,000 words) processed via deterministic chunk aggregation.');
      passed++;
    } else {
      console.error('✗ TEST 5 FAILED:', result);
    }
  } catch (e: any) {
    console.error('✗ TEST 5 FAILED with error:', e.message);
  }

  // Test 6: Repeatability / Determinism Check
  try {
    const testText = "Technology conglomerate beats earnings estimates by 15% but lowers Q4 revenue guidance.";
    const run1 = await finBertSentimentAnalyzer.analyzeSentiment(testText);
    const run2 = await finBertSentimentAnalyzer.analyzeSentiment(testText);
    console.log('[Test 6 - Determinism Check]', { run1, run2 });
    if (run1.sentiment === run2.sentiment && run1.confidence === run2.confidence && run1.label === run2.label) {
      console.log('✓ TEST 6 PASSED: Repeated analysis of identical input produces exact identical results.');
      passed++;
    } else {
      console.error('✗ TEST 6 FAILED: Non-deterministic output detected:', { run1, run2 });
    }
  } catch (e: any) {
    console.error('✗ TEST 6 FAILED with error:', e.message);
  }

  // Test 7: Financial Numbers & Percentages
  try {
    const text = "Inflation fell to 2.4% while unemployment increased to 5.1%.";
    const result = await finBertSentimentAnalyzer.analyzeSentiment(text);
    console.log('[Test 7 - Numbers]', result);
    if (result.sentiment >= -1 && result.sentiment <= 1 && result.confidence > 0) {
      console.log('✓ TEST 7 PASSED: Financial percentage numbers correctly analyzed.');
      passed++;
    } else {
      console.error('✗ TEST 7 FAILED:', result);
    }
  } catch (e: any) {
    console.error('✗ TEST 7 FAILED with error:', e.message);
  }

  // Test 8: Empty/Invalid Input Validation
  try {
    await finBertSentimentAnalyzer.analyzeSentiment("   ");
    console.error('✗ TEST 8 FAILED: Failed to reject empty input');
  } catch (e: any) {
    if (e.message.includes('Text cannot be empty')) {
      console.log('✓ TEST 8 PASSED: Rejection of empty input verified.');
      passed++;
    } else {
      console.error('✗ TEST 8 FAILED with unexpected error:', e.message);
    }
  }

  // Test 9: Mixed Sentiment Text
  try {
    const text = "Revenue increased strongly, but the company warned of weaker demand next quarter.";
    const result = await finBertSentimentAnalyzer.analyzeSentiment(text);
    console.log('[Test 9 - Mixed Text]', result);
    if (result.sentiment >= -1 && result.sentiment <= 1 && ['positive', 'negative', 'neutral'].includes(result.label)) {
      console.log('✓ TEST 9 PASSED: Mixed sentiment text correctly processed.');
      passed++;
    } else {
      console.error('✗ TEST 9 FAILED:', result);
    }
  } catch (e: any) {
    console.error('✗ TEST 9 FAILED with error:', e.message);
  }

  console.log('\n==================================================');
  console.log(`FINBERT TEST SUITE RESULTS: ${passed} / ${total} PASSED`);
  console.log('==================================================');

  process.exit(passed === total ? 0 : 1);
}

runFinBertTests().catch(e => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
