import fs from 'fs';
import path from 'path';
import { phase2EventClassifier, Phase2EventClassifier, resolvePhase2EventClassifierModelPath, VALID_EVENT_CATEGORIES } from '../src/providers/nlp/phase2-event-classifier';
import { nlpService } from '../src/providers/nlp/nlp.service';

async function runPhase2IntegrationTests() {
  console.log('================================================================');
  console.log('RUNNING PHASE 2 EVENT CLASSIFIER PRODUCTION INTEGRATION TESTS');
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

  // --- 1. Model Path Resolution & Model Files Exist ---
  try {
    const loc = resolvePhase2EventClassifierModelPath();
    assert(fs.existsSync(loc.fullPath) && fs.existsSync(path.join(loc.fullPath, 'onnx/model.onnx')),
      'Phase 2 model path resolved and onnx/model.onnx exists locally', loc);
  } catch (e: any) {
    assert(false, 'Phase 2 model path resolved and onnx/model.onnx exists locally', e.message);
  }

  // --- 2. Model Pipeline Loading & Caching ---
  try {
    Phase2EventClassifier.resetPipelineCache();
    const res1 = await phase2EventClassifier.classifyEvent("Federal Reserve interest rate hike");
    const loadedPath1 = Phase2EventClassifier.getLoadedModelPath();
    assert(res1 && loadedPath1 !== null, 'Phase 2 model loaded successfully', { loadedPath: loadedPath1, category: res1.predictedCategory });

    const res2 = await phase2EventClassifier.classifyEvent("Corporate credit default swap rates jump");
    const loadedPath2 = Phase2EventClassifier.getLoadedModelPath();
    assert(loadedPath1 === loadedPath2, 'Phase 2 model pipeline is cached and reused across calls');
  } catch (e: any) {
    assert(false, 'Phase 2 model loading & caching test', e.message);
  }

  // --- 3. Missing Model Path Handling ---
  try {
    process.env.PHASE2_EVENT_MODEL_PATH = path.resolve(__dirname, 'non_existent_model_dir_xyz');
    try {
      resolvePhase2EventClassifierModelPath();
      assert(false, 'Missing model path throws clear error');
    } catch (err: any) {
      assert(err.message.includes('not found') || err.message.includes('missing ONNX'), 'Missing model path throws clear error', err.message);
    } finally {
      delete process.env.PHASE2_EVENT_MODEL_PATH;
    }
  } catch (e: any) {
    assert(false, 'Missing model path test', e.message);
  }

  // --- 4. Label Mapping Verification (All 8 classes) ---
  try {
    assert(VALID_EVENT_CATEGORIES.length === 8, 'Valid event categories count is 8');
    const expected = [
      'Monetary policy', 'Credit', 'Commodities', 'Earnings',
      'Sector outlook', 'Geopolitical', 'Regulatory', 'Macroeconomic'
    ];
    const isMatch = expected.every((val, idx) => VALID_EVENT_CATEGORIES[idx] === val);
    assert(isMatch, 'All 8 event categories mapped identically to production specification', VALID_EVENT_CATEGORIES);
  } catch (e: any) {
    assert(false, 'Label mapping verification', e.message);
  }

  // --- 5-12. Individual Category Target Examples ---
  const categoryExamples: Array<{ category: string; text: string }> = [
    { category: 'Monetary policy', text: 'Federal Reserve officials raised benchmark interest rates by 50 basis points to combat inflation.' },
    { category: 'Credit', text: "Moody's downgraded the issuer credit rating to Caa1 following debt repayment default on senior notes." },
    { category: 'Commodities', text: 'Brent crude oil prices surged past $90 a barrel following supply disruption concerns in the Middle East.' },
    { category: 'Earnings', text: 'Tech giant reported Q4 net profit of $18.5 billion, significantly beating Wall Street consensus estimates.' },
    { category: 'Regulatory', text: 'The SEC filed antitrust enforcement charges against the tech conglomerate over anti-competitive practices.' },
    { category: 'Macroeconomic', text: 'Global economic growth is projected to slow to 2.1% this year due to persistent inflation and high debt.' }
  ];

  for (const item of categoryExamples) {
    try {
      const res = await phase2EventClassifier.classifyEvent(item.text);
      assert(res.predictedCategory === item.category, `Category test [${item.category}]: predicted="${res.predictedCategory}" (conf: ${res.confidence})`, res);
    } catch (e: any) {
      assert(false, `Category test [${item.category}]`, e.message);
    }
  }

  // --- 13. Confidence in [0, 1] Range & Valid Production Category ---
  try {
    const res = await phase2EventClassifier.classifyEvent("General news story about market trading volumes and global asset prices");
    assert(res.confidence >= 0 && res.confidence <= 1, 'Confidence score strictly in [0, 1] range', res.confidence);
    assert((VALID_EVENT_CATEGORIES as readonly string[]).includes(res.predictedCategory), 'Predicted category is one of 8 valid production categories', res.predictedCategory);
  } catch (e: any) {
    assert(false, 'Confidence range and valid category test', e.message);
  }

  // --- 14. Top-2 Output Exposure ---
  try {
    const res = await phase2EventClassifier.classifyEvent("Central bank signals interest rate cuts amid slowing macroeconomic activity.");
    assert(res.top2Category !== undefined && res.top2Confidence <= res.confidence, 'Top-2 category and confidence exposed correctly', { top1: res.predictedCategory, top1Conf: res.confidence, top2: res.top2Category, top2Conf: res.top2Confidence });
  } catch (e: any) {
    assert(false, 'Top-2 output exposure test', e.message);
  }

  // --- 15. Category Probabilities Map ---
  try {
    const res = await phase2EventClassifier.classifyEvent("Tech sector quarterly earnings report");
    const numKeys = Object.keys(res.categoryProbabilities).length;
    const sumProbs = Object.values(res.categoryProbabilities).reduce((a, b) => a + b, 0);
    assert(numKeys === 8 && Math.abs(sumProbs - 1.0) < 0.01, 'Category probabilities map contains all 8 classes summing to ~1.0', { numKeys, sumProbs });
  } catch (e: any) {
    assert(false, 'Category probabilities map test', e.message);
  }

  // --- 16. Authoritative Priority Over Gemini / Fallback Suggestion in NlpService ---
  try {
    // Pass a text that DevelopmentNlpProvider would classify as "Sector outlook" or "Macroeconomic"
    const text = "Federal Reserve officials raised benchmark interest rates by 50 basis points to combat inflation.";
    const meta = { title: "Fed Interest Rate Hike", source: "Test Feed", publishedAt: new Date().toISOString() };
    const event = await nlpService.analyzeAndPersist(meta, text);

    assert(event.category === 'Monetary policy', 'Phase 2 classifier category is authoritative in NlpService RiskEvent creation', { eventCategory: event.category });
    assert(Number(event.classification_confidence) > 0.8, 'RiskEvent stores classification_confidence from Phase 2 model', { confidence: event.classification_confidence });
  } catch (e: any) {
    assert(false, 'Authoritative Phase 2 category in NlpService test', e.message);
  }

  // --- 17. Fixed 32 Regression Examples Verification ---
  try {
    const regressionPath = path.resolve(__dirname, '../scratch/phase2_pytorch_vs_onnx_results.json');
    if (fs.existsSync(regressionPath)) {
      const regData = JSON.parse(fs.readFileSync(regressionPath, 'utf8'));
      const examples = regData.examples;
      let mismatches = 0;
      let maxConfDiff = 0;

      for (const item of examples) {
        const res = await phase2EventClassifier.classifyEvent(item.text);
        if (res.predictedCategory !== item.pytorch.top1_label) {
          mismatches++;
        }
        const cDiff = Math.abs(res.confidence - item.pytorch.top1_prob);
        if (cDiff > maxConfDiff) maxConfDiff = cDiff;
      }

      assert(mismatches === 0, `32 fixed regression examples match PyTorch/ONNX predictions (0 mismatches, max conf diff: ${maxConfDiff.toFixed(6)})`, { tested: examples.length, mismatches, maxConfDiff });
    } else {
      console.warn('Skipping regression test file check as scratch file was not found.');
    }
  } catch (e: any) {
    assert(false, '32 fixed regression examples verification', e.message);
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} / ${total} tests passed.`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runPhase2IntegrationTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
