import fs from 'fs';
import path from 'path';
import { finBertSentimentAnalyzer, FinBertSentimentAnalyzer } from '../src/providers/nlp/finbert-sentiment.analyzer';

interface BenchmarkItem {
  id: string;
  text: string;
  humanLabel: 'positive' | 'neutral' | 'negative';
  eventType: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface PredictionResult {
  id: string;
  text: string;
  humanLabel: 'positive' | 'neutral' | 'negative';
  predictedLabel: 'positive' | 'neutral' | 'negative';
  sentiment: number;
  confidence: number;
  eventType: string;
  difficulty: 'easy' | 'medium' | 'hard';
  isCorrect: boolean;
}

// Helper to calculate classification metrics
function calculateClassMetrics(gt: string[], pred: string[], className: string) {
  let tp = 0, fp = 0, fn = 0;
  for (let i = 0; i < gt.length; i++) {
    if (gt[i] === className && pred[i] === className) tp++;
    else if (gt[i] !== className && pred[i] === className) fp++;
    else if (gt[i] === className && pred[i] !== className) fn++;
  }
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1, tp, fp, fn };
}

// Strategy-aware analyzer for chunk experiments without mutating production class
async function runWithStrategy(
  text: string,
  strategy: '50-50-lead-body' | 'equal' | 'lead-only'
): Promise<{ sentiment: number; confidence: number; label: 'positive' | 'neutral' | 'negative' }> {
  // Use analyzer instance internal methods safely via prototype
  const analyzerAny = finBertSentimentAnalyzer as any;
  const classifier = await analyzerAny.getPipeline();
  const chunks: string[] = analyzerAny.chunkText(text.trim());

  if (strategy === 'lead-only' || chunks.length === 1) {
    const rawOutput = await classifier(chunks[0], { topk: null });
    let pPos = 0, pNeg = 0, pNeu = 0;
    const items = Array.isArray(rawOutput[0]) ? rawOutput[0] : rawOutput;
    items.forEach((item: any) => {
      const lbl = (item.label || '').toLowerCase();
      if (lbl === 'positive' || lbl === 'pos') pPos = Number(item.score);
      else if (lbl === 'negative' || lbl === 'neg') pNeg = Number(item.score);
      else if (lbl === 'neutral' || lbl === 'neu') pNeu = Number(item.score);
    });
    const maxProb = Math.max(pPos, pNeg, pNeu);
    let label: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (maxProb === pPos) label = 'positive';
    else if (maxProb === pNeg) label = 'negative';
    return {
      sentiment: Number((pPos - pNeg).toFixed(4)),
      confidence: Number(maxProb.toFixed(4)),
      label
    };
  }

  const chunkResults: Array<{ pos: number; neg: number; neu: number }> = [];
  for (const chunk of chunks) {
    const rawOutput = await classifier(chunk, { topk: null });
    let pPos = 0, pNeg = 0, pNeu = 0;
    const items = Array.isArray(rawOutput[0]) ? rawOutput[0] : rawOutput;
    items.forEach((item: any) => {
      const lbl = (item.label || '').toLowerCase();
      if (lbl === 'positive' || lbl === 'pos') pPos = Number(item.score);
      else if (lbl === 'negative' || lbl === 'neg') pNeg = Number(item.score);
      else if (lbl === 'neutral' || lbl === 'neu') pNeu = Number(item.score);
    });
    chunkResults.push({ pos: pPos, neg: pNeg, neu: pNeu });
  }

  let pPos = 0, pNeg = 0, pNeu = 0;
  if (strategy === 'equal') {
    const w = 1 / chunkResults.length;
    chunkResults.forEach(r => {
      pPos += r.pos * w;
      pNeg += r.neg * w;
      pNeu += r.neu * w;
    });
  } else {
    // 50-50 lead-body
    const leadW = 0.5;
    const bodyW = 0.5 / (chunkResults.length - 1);
    chunkResults.forEach((r, idx) => {
      const w = idx === 0 ? leadW : bodyW;
      pPos += r.pos * w;
      pNeg += r.neg * w;
      pNeu += r.neu * w;
    });
  }

  const total = pPos + pNeg + pNeu;
  if (total > 0) { pPos /= total; pNeg /= total; pNeu /= total; }

  const maxProb = Math.max(pPos, pNeg, pNeu);
  let label: 'positive' | 'neutral' | 'negative' = 'neutral';
  if (maxProb === pPos) label = 'positive';
  else if (maxProb === pNeg) label = 'negative';

  return {
    sentiment: Number((pPos - pNeg).toFixed(4)),
    confidence: Number(maxProb.toFixed(4)),
    label
  };
}

async function runFinBertEvaluation() {
  console.log('==================================================');
  console.log('PHASE 1B — FINBERT FINANCIAL SENTIMENT EVALUATION');
  console.log('==================================================\n');

  // 1. Load Dataset & Quality Audit
  const datasetPath = path.resolve(__dirname, 'fixtures', 'financial-benchmark-100.json');
  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Dataset file not found at ${datasetPath}`);
  }

  const dataset: BenchmarkItem[] = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  console.log('--- 1. DATASET QUALITY & INTEGRITY AUDIT ---');
  const ids = new Set<string>();
  const texts = new Set<string>();
  const classCounts: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
  const diffCounts: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  const eventCounts: Record<string, number> = {};

  dataset.forEach((item, idx) => {
    if (ids.has(item.id)) throw new Error(`Duplicate ID found: ${item.id}`);
    ids.add(item.id);

    const normText = item.text.trim().toLowerCase();
    if (texts.has(normText)) throw new Error(`Duplicate text found at index ${idx}: "${item.text.substring(0, 40)}"`);
    texts.add(normText);

    if (!['positive', 'neutral', 'negative'].includes(item.humanLabel)) {
      throw new Error(`Invalid humanLabel '${item.humanLabel}' for ID ${item.id}`);
    }

    classCounts[item.humanLabel] = (classCounts[item.humanLabel] || 0) + 1;
    diffCounts[item.difficulty] = (diffCounts[item.difficulty] || 0) + 1;
    eventCounts[item.eventType] = (eventCounts[item.eventType] || 0) + 1;
  });

  console.log(`✓ Total Unique Examples: ${dataset.length}`);
  console.log(`✓ Class Distribution:    Positive: ${classCounts.positive} | Neutral: ${classCounts.neutral} | Negative: ${classCounts.negative}`);
  console.log(`✓ Difficulty Distribution: Easy: ${diffCounts.easy} | Medium: ${diffCounts.medium} | Hard: ${diffCounts.hard}`);
  console.log('✓ Event Type Distribution:', JSON.stringify(eventCounts, null, 2));

  // 2. Primary Evaluation (Current Strategy)
  console.log('\n--- 2. RUNNING PRIMARY EVALUATION ---');
  const results: PredictionResult[] = [];
  const latencies: number[] = [];

  for (const item of dataset) {
    const t0 = Date.now();
    const res = await finBertSentimentAnalyzer.analyzeSentiment(item.text);
    const t1 = Date.now();
    latencies.push(t1 - t0);

    results.push({
      id: item.id,
      text: item.text,
      humanLabel: item.humanLabel,
      predictedLabel: res.label,
      sentiment: res.sentiment,
      confidence: res.confidence,
      eventType: item.eventType,
      difficulty: item.difficulty,
      isCorrect: res.label === item.humanLabel
    });
  }

  // Calculate Overall Metrics
  const correctCount = results.filter(r => r.isCorrect).length;
  const accuracy = (correctCount / results.length) * 100;

  const groundTruths = results.map(r => r.humanLabel);
  const predictions = results.map(r => r.predictedLabel);

  const posMetrics = calculateClassMetrics(groundTruths, predictions, 'positive');
  const neuMetrics = calculateClassMetrics(groundTruths, predictions, 'neutral');
  const negMetrics = calculateClassMetrics(groundTruths, predictions, 'negative');

  const macroPrecision = (posMetrics.precision + neuMetrics.precision + negMetrics.precision) / 3;
  const macroRecall = (posMetrics.recall + neuMetrics.recall + negMetrics.recall) / 3;
  const macroF1 = (posMetrics.f1 + neuMetrics.f1 + negMetrics.f1) / 3;

  // 3x3 Confusion Matrix
  const confusionMatrix: Record<string, Record<string, number>> = {
    positive: { positive: 0, neutral: 0, negative: 0 },
    neutral: { positive: 0, neutral: 0, negative: 0 },
    negative: { positive: 0, neutral: 0, negative: 0 }
  };

  results.forEach(r => {
    confusionMatrix[r.humanLabel][r.predictedLabel]++;
  });

  console.log(`\nOverall Accuracy: ${accuracy.toFixed(1)}% (${correctCount}/${results.length})`);
  console.log(`Macro Precision:  ${(macroPrecision * 100).toFixed(1)}%`);
  console.log(`Macro Recall:     ${(macroRecall * 100).toFixed(1)}%`);
  console.log(`Macro F1 Score:   ${(macroF1 * 100).toFixed(1)}%`);

  console.log('\n--- Per-Class Performance ---');
  console.table({
    Positive: { Precision: `${(posMetrics.precision * 100).toFixed(1)}%`, Recall: `${(posMetrics.recall * 100).toFixed(1)}%`, F1: `${(posMetrics.f1 * 100).toFixed(1)}%` },
    Neutral:  { Precision: `${(neuMetrics.precision * 100).toFixed(1)}%`, Recall: `${(neuMetrics.recall * 100).toFixed(1)}%`, F1: `${(neuMetrics.f1 * 100).toFixed(1)}%` },
    Negative: { Precision: `${(negMetrics.precision * 100).toFixed(1)}%`, Recall: `${(negMetrics.recall * 100).toFixed(1)}%`, F1: `${(negMetrics.f1 * 100).toFixed(1)}%` }
  });

  console.log('\n--- Confusion Matrix (Rows: Ground Truth, Cols: Prediction) ---');
  console.table(confusionMatrix);

  // 3. Difficulty Breakdown
  console.log('\n--- 3. PERFORMANCE BY DIFFICULTY ---');
  const difficultyReport: any = {};
  ['easy', 'medium', 'hard'].forEach(diff => {
    const subset = results.filter(r => r.difficulty === diff);
    const subGt = subset.map(r => r.humanLabel);
    const subPred = subset.map(r => r.predictedLabel);
    const subAcc = (subset.filter(r => r.isCorrect).length / subset.length) * 100;
    const subPos = calculateClassMetrics(subGt, subPred, 'positive');
    const subNeu = calculateClassMetrics(subGt, subPred, 'neutral');
    const subNeg = calculateClassMetrics(subGt, subPred, 'negative');
    const subMacroF1 = (subPos.f1 + subNeu.f1 + subNeg.f1) / 3;
    difficultyReport[diff] = {
      Count: subset.length,
      Accuracy: `${subAcc.toFixed(1)}%`,
      'Macro F1': `${(subMacroF1 * 100).toFixed(1)}%`
    };
  });
  console.table(difficultyReport);

  // 4. Event Type Breakdown
  console.log('\n--- 4. PERFORMANCE BY EVENT TYPE ---');
  const eventReport: any = {};
  Object.keys(eventCounts).forEach(evt => {
    const subset = results.filter(r => r.eventType === evt);
    const subGt = subset.map(r => r.humanLabel);
    const subPred = subset.map(r => r.predictedLabel);
    const subAcc = (subset.filter(r => r.isCorrect).length / subset.length) * 100;
    const subPos = calculateClassMetrics(subGt, subPred, 'positive');
    const subNeu = calculateClassMetrics(subGt, subPred, 'neutral');
    const subNeg = calculateClassMetrics(subGt, subPred, 'negative');
    const subMacroF1 = (subPos.f1 + subNeu.f1 + subNeg.f1) / 3;
    eventReport[evt] = {
      Count: subset.length,
      Accuracy: `${subAcc.toFixed(1)}%`,
      'Macro F1': `${(subMacroF1 * 100).toFixed(1)}%`
    };
  });
  console.table(eventReport);

  // 5. Confidence Analysis
  console.log('\n--- 5. CONFIDENCE ANALYSIS ---');
  const correctResults = results.filter(r => r.isCorrect);
  const incorrectResults = results.filter(r => !r.isCorrect);

  const avgConfCorrect = correctResults.reduce((s, r) => s + r.confidence, 0) / (correctResults.length || 1);
  const avgConfIncorrect = incorrectResults.reduce((s, r) => s + r.confidence, 0) / (incorrectResults.length || 1);

  const confBuckets = { '[0.3-0.5)': 0, '[0.5-0.7)': 0, '[0.7-0.9)': 0, '[0.9-1.0]': 0 };
  results.forEach(r => {
    if (r.confidence < 0.5) confBuckets['[0.3-0.5)']++;
    else if (r.confidence < 0.7) confBuckets['[0.5-0.7)']++;
    else if (r.confidence < 0.9) confBuckets['[0.7-0.9)']++;
    else confBuckets['[0.9-1.0]']++;
  });

  const highConfErrors80 = incorrectResults.filter(r => r.confidence >= 0.80);
  const highConfErrors90 = incorrectResults.filter(r => r.confidence >= 0.90);

  console.log(`Avg Confidence (Correct Predictions):   ${avgConfCorrect.toFixed(4)}`);
  console.log(`Avg Confidence (Incorrect Predictions): ${avgConfIncorrect.toFixed(4)}`);
  console.log('Confidence Distribution Buckets:', JSON.stringify(confBuckets));
  console.log(`High Confidence Errors (>= 0.80): ${highConfErrors80.length}`);
  console.log(`High Confidence Errors (>= 0.90): ${highConfErrors90.length}`);

  // 6. Detailed Error Analysis
  console.log('\n--- 6. DETAILED ERROR ANALYSIS & ITEMIZATION ---');
  const errorItems = incorrectResults.map(r => {
    let errorPattern = 'Financial Idiom / Context Misunderstanding';
    const textLower = r.text.toLowerCase();
    if (textLower.includes('climb') || textLower.includes('rose') || textLower.includes('rises')) {
      errorPattern = 'Directional Verb / Noun Confusion (e.g. "defaults climb")';
    } else if (textLower.includes('despite') || textLower.includes('warned') || textLower.includes('however')) {
      errorPattern = 'Mixed Sentiment Conflict';
    } else if (textLower.includes('rate') || textLower.includes('yield') || textLower.includes('inflation')) {
      errorPattern = 'Macroeconomic Indicator Direction Ambiguity';
    } else if (r.humanLabel === 'neutral' || r.predictedLabel === 'neutral') {
      errorPattern = 'Neutral Threshold Ambiguity';
    }

    return {
      ID: r.id,
      GroundTruth: r.humanLabel,
      Predicted: r.predictedLabel,
      Score: (r.sentiment >= 0 ? '+' : '') + r.sentiment.toFixed(4),
      Conf: r.confidence.toFixed(4),
      Event: r.eventType,
      Diff: r.difficulty,
      ErrorPattern: errorPattern,
      TextSnippet: r.text.length > 55 ? r.text.substring(0, 52) + '...' : r.text
    };
  });
  console.table(errorItems);

  // Grouped Error Patterns Summary
  const patternCounts: Record<string, number> = {};
  errorItems.forEach(e => {
    patternCounts[e.ErrorPattern] = (patternCounts[e.ErrorPattern] || 0) + 1;
  });
  console.log('\nError Pattern Summary:', JSON.stringify(patternCounts, null, 2));

  // 7. Chunk Aggregation Strategy Comparison
  console.log('\n--- 7. CHUNK AGGREGATION STRATEGY COMPARISON ---');
  const stratA_res: string[] = [];
  const stratB_res: string[] = [];
  const stratC_res: string[] = [];

  for (const item of dataset) {
    const resA = await runWithStrategy(item.text, '50-50-lead-body');
    const resB = await runWithStrategy(item.text, 'equal');
    const resC = await runWithStrategy(item.text, 'lead-only');
    stratA_res.push(resA.label);
    stratB_res.push(resB.label);
    stratC_res.push(resC.label);
  }

  const getAccuracy = (preds: string[]) => (preds.filter((p, i) => p === groundTruths[i]).length / dataset.length) * 100;
  const getMacroF1 = (preds: string[]) => {
    const pos = calculateClassMetrics(groundTruths, preds, 'positive');
    const neu = calculateClassMetrics(groundTruths, preds, 'neutral');
    const neg = calculateClassMetrics(groundTruths, preds, 'negative');
    return ((pos.f1 + neu.f1 + neg.f1) / 3) * 100;
  };

  console.table({
    'Strategy A (50% Lead / 50% Body)': { Accuracy: `${getAccuracy(stratA_res).toFixed(1)}%`, 'Macro F1': `${getMacroF1(stratA_res).toFixed(1)}%` },
    'Strategy B (Equal Weighting)':     { Accuracy: `${getAccuracy(stratB_res).toFixed(1)}%`, 'Macro F1': `${getMacroF1(stratB_res).toFixed(1)}%` },
    'Strategy C (Lead Only Baseline)': { Accuracy: `${getAccuracy(stratC_res).toFixed(1)}%`, 'Macro F1': `${getMacroF1(stratC_res).toFixed(1)}%` }
  });

  // 8. Latency Benchmark
  console.log('\n--- 8. LATENCY BENCHMARK BY TEXT LENGTH ---');
  const shortTexts = dataset.filter(d => d.text.split(/\s+/).length < 30);
  const medTexts = dataset.filter(d => d.text.split(/\s+/).length >= 30 && d.text.split(/\s+/).length <= 60);
  const longTexts = dataset.filter(d => d.text.split(/\s+/).length > 60);

  async function measureLatencyForGroup(items: BenchmarkItem[]) {
    const times: number[] = [];
    for (const item of items) {
      const t0 = Date.now();
      await finBertSentimentAnalyzer.analyzeSentiment(item.text);
      times.push(Date.now() - t0);
    }
    times.sort((a, b) => a - b);
    const avg = times.reduce((s, t) => s + t, 0) / (times.length || 1);
    const median = times.length > 0 ? times[Math.floor(times.length / 2)] : 0;
    const max = times.length > 0 ? times[times.length - 1] : 0;
    return { Count: items.length, 'Avg (ms)': parseFloat(avg.toFixed(1)), 'Median (ms)': median, 'Max (ms)': max };
  }

  const shortLat = await measureLatencyForGroup(shortTexts);
  const medLat = await measureLatencyForGroup(medTexts);
  const longLat = await measureLatencyForGroup(longTexts);

  console.table({
    'Short Text (<30 words)': shortLat,
    'Medium Text (30-60 words)': medLat,
    'Long Text (>60 words / Multi-paragraph)': longLat
  });

  console.log('\n==================================================');
  console.log('FINAL EVALUATION COMPLETED');
  console.log('==================================================\n');

  process.exit(0);
}

runFinBertEvaluation().catch(e => {
  console.error('Evaluation Error:', e);
  process.exit(1);
});
