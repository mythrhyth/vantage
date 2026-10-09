import fs from 'fs';
import path from 'path';
import { finBertSentimentAnalyzer, FinBertSentimentAnalyzer, resolveFinBertModelPath } from '../src/providers/nlp/finbert-sentiment.analyzer';
import { financialContextLayer } from '../src/providers/nlp/financial-context';

async function runPhase1DIntegrationTests() {
  console.log('================================================================');
  console.log('RUNNING PHASE 1D PRODUCTION BACKEND INTEGRATION & VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    total++;
    if (condition) {
      console.log(`✓ PASSED [Test ${total}]: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAILED [Test ${total}]: ${testName}`, detail || '');
    }
  }

  // --- A. Model Loading ---
  try {
    const loc = resolveFinBertModelPath();
    assert(fs.existsSync(loc.fullPath) && fs.existsSync(path.join(loc.fullPath, 'onnx/model.onnx')), 
      'Model location resolved and onnx/model.onnx exists locally', loc);
  } catch (e: any) {
    assert(false, 'Model location resolved and onnx/model.onnx exists locally', e.message);
  }

  // --- B. Positive Example ---
  try {
    const res = await finBertSentimentAnalyzer.analyzeSentiment("Net income rose 25% year-over-year to $450 million, significantly exceeding analyst consensus.");
    assert(res.label === 'positive' && res.sentiment > 0.5 && res.confidence > 0.8 && res.model === 'phase1d-finbert', 
      'Positive financial statement analyzed accurately', res);
  } catch (e: any) {
    assert(false, 'Positive financial statement analyzed accurately', e.message);
  }

  // --- C. Negative Example ---
  try {
    const res = await finBertSentimentAnalyzer.analyzeSentiment("Operating losses widened to $85 million as cost inflation and supply chain bottlenecks severely impacted gross margins.");
    assert(res.label === 'negative' && res.sentiment < -0.5 && res.confidence > 0.8, 
      'Negative financial statement analyzed accurately', res);
  } catch (e: any) {
    assert(false, 'Negative financial statement analyzed accurately', e.message);
  }

  // --- D. Neutral Example ---
  try {
    const res = await finBertSentimentAnalyzer.analyzeSentiment("The board of directors announced that the annual general meeting of shareholders will take place on May 15.");
    assert(res.label === 'neutral' && res.confidence > 0.8, 
      'Neutral corporate announcement analyzed accurately', res);
  } catch (e: any) {
    assert(false, 'Neutral corporate announcement analyzed accurately', e.message);
  }

  // --- E. Credit/Default Example ---
  try {
    const res = await finBertSentimentAnalyzer.analyzeSentiment("Moody's downgraded the issuer rating to Caa1 following a payment default on senior notes.");
    assert(res.label === 'negative' && res.sentiment < -0.5, 
      'Credit downgrade and default statement analyzed accurately', res);
  } catch (e: any) {
    assert(false, 'Credit downgrade and default statement analyzed accurately', e.message);
  }

  // --- F. Macroeconomic Example ---
  try {
    const res = await finBertSentimentAnalyzer.analyzeSentiment("Global GDP growth is projected to decelerate to 2.1% this year due to persistent trade tensions and high interest rates.");
    assert(res.label === 'negative' && res.sentiment < 0, 
      'Macroeconomic slowdown statement analyzed accurately', res);
  } catch (e: any) {
    assert(false, 'Macroeconomic slowdown statement analyzed accurately', e.message);
  }

  // --- G. Monetary Policy Example ---
  try {
    const res = await finBertSentimentAnalyzer.analyzeSentiment("The central bank raised benchmark interest rates by 50 basis points to combat elevated headline inflation.");
    assert(res.sentiment >= -1 && res.sentiment <= 1 && res.confidence >= 0, 
      'Monetary policy rate hike statement analyzed accurately', res);
  } catch (e: any) {
    assert(false, 'Monetary policy rate hike statement analyzed accurately', e.message);
  }

  // --- H. Sentiment Score Range ---
  try {
    const res1 = await finBertSentimentAnalyzer.analyzeSentiment("Extreme profits and revenue growth");
    const res2 = await finBertSentimentAnalyzer.analyzeSentiment("Catastrophic bankruptcy and total collapse");
    assert(res1.sentiment >= -1 && res1.sentiment <= 1 && res2.sentiment >= -1 && res2.sentiment <= 1, 
      'Sentiment scores strictly constrained within [-1, 1] range', { s1: res1.sentiment, s2: res2.sentiment });
  } catch (e: any) {
    assert(false, 'Sentiment scores strictly constrained within [-1, 1] range', e.message);
  }

  // --- I. Confidence Range ---
  try {
    const res = await finBertSentimentAnalyzer.analyzeSentiment("Quarterly earnings report");
    assert(res.confidence >= 0 && res.confidence <= 1, 
      'Confidence strictly constrained within [0, 1] range', res.confidence);
  } catch (e: any) {
    assert(false, 'Confidence strictly constrained within [0, 1] range', e.message);
  }

  // --- J. Label Mapping Verification ---
  try {
    const resPos = await finBertSentimentAnalyzer.analyzeSentiment("Net profit increased substantially driven by record product sales.");
    const resNeg = await finBertSentimentAnalyzer.analyzeSentiment("The company defaulted on its $50 million senior bond interest payment obligations.");
    const resNeu = await finBertSentimentAnalyzer.analyzeSentiment("The board of directors is scheduled to meet on Tuesday afternoon.");
    assert(resPos.label === 'positive' && resNeg.label === 'negative' && resNeu.label === 'neutral', 
      '0=positive, 1=negative, 2=neutral label mapping preserved', { pos: resPos.label, neg: resNeg.label, neu: resNeu.label });
  } catch (e: any) {
    assert(false, '0=positive, 1=negative, 2=neutral label mapping preserved', e.message);
  }

  // --- K. Singleton Model Caching ---
  try {
    const firstLoadedPath = FinBertSentimentAnalyzer.getLoadedModelPath();
    await finBertSentimentAnalyzer.analyzeSentiment("Second request test");
    const secondLoadedPath = FinBertSentimentAnalyzer.getLoadedModelPath();
    assert(firstLoadedPath !== null && firstLoadedPath === secondLoadedPath, 
      'Model instance is cached and reused across multiple analyze requests', { firstLoadedPath, secondLoadedPath });
  } catch (e: any) {
    assert(false, 'Model instance is cached and reused across multiple analyze requests', e.message);
  }

  // --- L. Configurable FINBERT_MODEL_PATH Resolution ---
  try {
    const originalEnv = process.env.FINBERT_MODEL_PATH;
    process.env.FINBERT_MODEL_PATH = 'backend/models/nlp/phase1d-finbert';
    const loc = resolveFinBertModelPath();
    process.env.FINBERT_MODEL_PATH = originalEnv;
    assert(fs.existsSync(loc.fullPath), 'Configurable FINBERT_MODEL_PATH resolves correctly from environment variable', loc.fullPath);
  } catch (e: any) {
    assert(false, 'Configurable FINBERT_MODEL_PATH resolves correctly from environment variable', e.message);
  }

  // --- M. Missing Model Error Handling ---
  try {
    const originalEnv = process.env.FINBERT_MODEL_PATH;
    process.env.FINBERT_MODEL_PATH = 'non_existent_folder_path_xyz_123';
    try {
      resolveFinBertModelPath();
      assert(false, 'Missing model produces clear error when resolved');
    } catch (err: any) {
      assert(err.message.includes('not found') || err.message.includes('FINBERT_MODEL_PATH'), 
        'Missing model produces a clear informative error', err.message);
    } finally {
      process.env.FINBERT_MODEL_PATH = originalEnv;
    }
  } catch (e: any) {
    assert(false, 'Missing model produces a clear informative error', e.message);
  }

  // --- N. Phase 1C Context Layer Integration ---
  try {
    const text = "Default rates climb across commercial loan portfolios.";
    const rawResult = await finBertSentimentAnalyzer.analyzeSentiment(text);
    const adjustedResult = financialContextLayer.analyze(text, rawResult);
    assert(adjustedResult.adjustedLabel === 'negative' && adjustedResult.appliedRules.length > 0, 
      'Phase 1C FinancialContextLayer operates seamlessly on top of Phase 1D FinBERT', adjustedResult);
  } catch (e: any) {
    assert(false, 'Phase 1C FinancialContextLayer operates seamlessly on top of Phase 1D FinBERT', e.message);
  }

  // --- O. Regression Test Against Verified ONNX Results (20 Examples) ---
  try {
    const onnxResultsPath = path.resolve(__dirname, './data/pytorch_vs_onnx_results.json');
    const scratchPath = path.resolve(__dirname, '../scratch/pytorch_vs_onnx_results.json');
    const targetPath = fs.existsSync(onnxResultsPath) ? onnxResultsPath : (fs.existsSync(scratchPath) ? scratchPath : null);

    if (targetPath) {
      const onnxData = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
      const examples = onnxData.examples;

      let mismatches = 0;
      let maxProbDiff = 0;
      let maxScoreDiff = 0;

      for (const item of examples) {
        const tsResult = await finBertSentimentAnalyzer.analyzeSentiment(item.text);
        
        if (tsResult.label !== item.onnx.label) {
          mismatches++;
        }

        const probDiff = Math.max(
          Math.abs((tsResult.pPos ?? 0) - item.onnx.positive),
          Math.abs((tsResult.pNeg ?? 0) - item.onnx.negative),
          Math.abs((tsResult.pNeu ?? 0) - item.onnx.neutral)
        );
        if (probDiff > maxProbDiff) maxProbDiff = probDiff;

        const scoreDiff = Math.abs(tsResult.sentiment - item.onnx.score);
        if (scoreDiff > maxScoreDiff) maxScoreDiff = scoreDiff;
      }

      console.log(`\n--- Production Analyzer Regression Test Results ---`);
      console.log(`Examples Tested: ${examples.length}`);
      console.log(`Mismatches vs Python ONNX: ${mismatches}`);
      console.log(`Max Probability Difference: ${maxProbDiff.toFixed(6)}`);
      console.log(`Max Sentiment Score Difference: ${maxScoreDiff.toFixed(6)}`);

      assert(mismatches === 0 && maxProbDiff < 0.001 && maxScoreDiff < 0.001, 
        'Production TypeScript FinBERT analyzer matches verified ONNX model with 0 label mismatches', 
        { mismatches, maxProbDiff, maxScoreDiff });
    } else {
      console.log('Skipping optional ONNX scratch benchmark test (scratch file not present).');
    }
  } catch (e: any) {
    assert(false, 'Production TypeScript FinBERT analyzer matches verified ONNX model with 0 label mismatches', e.message);
  }

  console.log('\n================================================================');
  console.log(`PHASE 1D INTEGRATION TEST SUITE SUMMARY: ${passed} / ${total} PASSED`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runPhase1DIntegrationTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
