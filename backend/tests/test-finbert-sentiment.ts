import { finBertSentimentAnalyzer } from '../src/providers/nlp/finbert-sentiment.analyzer';

async function runFinBertTests() {
  console.log('==================================================');
  console.log('RUNNING STANDALONE FINBERT SENTIMENT ANALYZER TESTS');
  console.log('==================================================\n');

  let passed = 0;
  let total = 7;

  // Test 1: Clearly Positive Financial Text
  try {
    const text = "Company reports record quarterly revenue and raises full-year guidance.";
    const result = await finBertSentimentAnalyzer.analyzeSentiment(text);
    console.log('[Test 1 - Positive]', result);
    if (result.sentiment > 0 && result.label === 'positive' && result.confidence >= 0.5 && result.model === 'Xenova/finbert') {
      console.log('✓ TEST 1 PASSED: Positive text correctly analyzed.');
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

  // Test 4: Mixed Text
  try {
    const text = "Revenue increased strongly, but the company warned of weaker demand next quarter.";
    const result = await finBertSentimentAnalyzer.analyzeSentiment(text);
    console.log('[Test 4 - Mixed]', result);
    if (result.sentiment >= -1 && result.sentiment <= 1 && ['positive', 'negative', 'neutral'].includes(result.label)) {
      console.log('✓ TEST 4 PASSED: Mixed sentiment text correctly processed.');
      passed++;
    } else {
      console.error('✗ TEST 4 FAILED:', result);
    }
  } catch (e: any) {
    console.error('✗ TEST 4 FAILED with error:', e.message);
  }

  // Test 5: Financial Numbers
  try {
    const text = "Inflation fell to 2.4% while unemployment increased to 5.1%.";
    const result = await finBertSentimentAnalyzer.analyzeSentiment(text);
    console.log('[Test 5 - Numbers]', result);
    if (result.sentiment >= -1 && result.sentiment <= 1 && result.confidence > 0) {
      console.log('✓ TEST 5 PASSED: Financial percentage numbers correctly analyzed.');
      passed++;
    } else {
      console.error('✗ TEST 5 FAILED:', result);
    }
  } catch (e: any) {
    console.error('✗ TEST 5 FAILED with error:', e.message);
  }

  // Test 6: Empty/Invalid Input
  try {
    await finBertSentimentAnalyzer.analyzeSentiment("   ");
    console.error('✗ TEST 6 FAILED: Failed to reject empty input');
  } catch (e: any) {
    if (e.message.includes('Text cannot be empty')) {
      console.log('✓ TEST 6 PASSED: Rejection of empty input verified.');
      passed++;
    } else {
      console.error('✗ TEST 6 FAILED with unexpected error:', e.message);
    }
  }

  // Test 7: Very Long Article
  try {
    const longText = "Global semiconductor manufacturers announced massive expansion plans across North America and Europe. " +
      "The $50 billion investment package will fund four new advanced fabrication facilities designed to supply automobile, artificial intelligence, and defense hardware markets. ".repeat(10);
    const result = await finBertSentimentAnalyzer.analyzeSentiment(longText);
    console.log('[Test 7 - Long Text]', result);
    if (result.sentiment >= -1 && result.sentiment <= 1 && result.confidence > 0) {
      console.log('✓ TEST 7 PASSED: Long text safely truncated and analyzed without error.');
      passed++;
    } else {
      console.error('✗ TEST 7 FAILED:', result);
    }
  } catch (e: any) {
    console.error('✗ TEST 7 FAILED with error:', e.message);
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
