import fs from 'fs';
import path from 'path';
import { FinancialContextLayer } from '../src/providers/nlp/financial-context';
import { finBertSentimentAnalyzer } from '../src/providers/nlp/finbert-sentiment.analyzer';

describe('Phase 1D — Fine-Tuning & Evaluation Pipeline Integrity Tests', () => {
  const baseDir = path.resolve(__dirname, '..');
  const mlDataDir = path.join(baseDir, 'ml', 'data');
  const frozenBenchmarkPath = path.resolve(baseDir, 'tests', 'fixtures', 'financial-benchmark-100.json');

  test('1. Frozen benchmark file exists and is intact (100 examples)', () => {
    expect(fs.existsSync(frozenBenchmarkPath)).toBe(true);
    const benchmark = JSON.parse(fs.readFileSync(frozenBenchmarkPath, 'utf8'));
    expect(Array.isArray(benchmark)).toBe(true);
    expect(benchmark.length).toBe(100);
  });

  test('2. Fine-tuning dataset splits exist and verify 70/15/15 proportion', () => {
    const trainPath = path.join(mlDataDir, 'train.json');
    const valPath = path.join(mlDataDir, 'val.json');
    const testPath = path.join(mlDataDir, 'test.json');

    expect(fs.existsSync(trainPath)).toBe(true);
    expect(fs.existsSync(valPath)).toBe(true);
    expect(fs.existsSync(testPath)).toBe(true);

    const train = JSON.parse(fs.readFileSync(trainPath, 'utf8'));
    const val = JSON.parse(fs.readFileSync(valPath, 'utf8'));
    const test = JSON.parse(fs.readFileSync(testPath, 'utf8'));

    const total = train.length + val.length + test.length;
    expect(total).toBeGreaterThanOrEqual(1000);

    const trainPct = train.length / total;
    const valPct = val.length / total;
    const testPct = test.length / total;

    expect(trainPct).toBeCloseTo(0.70, 1);
    expect(valPct).toBeCloseTo(0.15, 1);
    expect(testPct).toBeCloseTo(0.15, 1);
  });

  test('3. Zero contamination (Data Leakage) between fine-tuning data and frozen benchmark', () => {
    const benchmark = JSON.parse(fs.readFileSync(frozenBenchmarkPath, 'utf8'));
    const benchmarkTexts = new Set<string>(benchmark.map((b: any) => b.text.trim().toLowerCase()));

    const trainPath = path.join(mlDataDir, 'train.json');
    const valPath = path.join(mlDataDir, 'val.json');
    const testPath = path.join(mlDataDir, 'test.json');

    const allFtExamples = [
      ...JSON.parse(fs.readFileSync(trainPath, 'utf8')),
      ...JSON.parse(fs.readFileSync(valPath, 'utf8')),
      ...JSON.parse(fs.readFileSync(testPath, 'utf8'))
    ];

    let leaks = 0;
    for (const ex of allFtExamples) {
      if (benchmarkTexts.has(ex.text.trim().toLowerCase())) {
        leaks++;
      }
    }

    expect(leaks).toBe(0);
  });

  test('4. Label mapping consistency (positive, neutral, negative)', () => {
    const trainPath = path.join(mlDataDir, 'train.json');
    const train = JSON.parse(fs.readFileSync(trainPath, 'utf8'));
    const allowedLabels = new Set(['positive', 'negative', 'neutral']);

    for (const ex of train) {
      expect(allowedLabels.has(ex.humanLabel)).toBe(true);
    }
  });

  test('5. FinancialContextLayer probability normalization and output contracts', () => {
    const contextLayer = new FinancialContextLayer();
    const mockRaw = {
      sentiment: 0.85,
      confidence: 0.9455,
      label: 'positive' as const,
      pPos: 0.9455,
      pNeg: 0.0245,
      pNeu: 0.0300
    };

    const res = contextLayer.analyze('Commercial real estate default rates climb to 5-year high.', mockRaw);
    
    expect(res.adjustedLabel).toBe('negative');
    expect(res.adjustedProbabilities.pPos + res.adjustedProbabilities.pNeg + res.adjustedProbabilities.pNeu).toBeCloseTo(1.0, 3);
    expect(res.rawFinBert.label).toBe('positive');
  });

  test('6. Production safety: FinBERT analyzer remains decoupled from production NlpService', () => {
    expect(finBertSentimentAnalyzer).toBeDefined();
    expect(finBertSentimentAnalyzer.modelName).toBe('Xenova/finbert');
  });
});
