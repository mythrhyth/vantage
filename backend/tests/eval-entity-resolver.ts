import fs from 'fs';
import path from 'path';
import { entityResolver } from '../src/services/ingestion/entity-resolver';
import { prisma } from '../src/db';

async function evaluateEntityResolver() {
  console.log('--- STARTING PHASE 3 EVALUATION ON 50-EXAMPLE BENCHMARK ---');

  const benchmarkPath = path.resolve(__dirname, 'data', 'entity-relevance-benchmark-50.json');
  if (!fs.existsSync(benchmarkPath)) {
    throw new Error(`Benchmark file not found: ${benchmarkPath}`);
  }

  const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
  console.log(`Loaded Benchmark: ${benchmark.length} curated examples.`);

  // Load target portfolio
  const portfolio = await prisma.portfolio.findFirst({ include: { assets: true } });
  if (!portfolio) {
    throw new Error('No portfolio found in database for evaluation.');
  }

  console.log(`Evaluating against Portfolio: "${portfolio.name}" (ID: ${portfolio.id})`);

  let correctRelevanceType = 0;
  let totalDirectEvaluations = 0;
  let falseDirectMatches = 0;

  const relevancePredictions: string[] = [];
  const relevanceTargets: string[] = [];

  let entityTP = 0;
  let entityFP = 0;
  let entityFN = 0;

  let assetTP = 0;
  let assetFP = 0;
  let assetFN = 0;

  for (const item of benchmark) {
    const analysis = await entityResolver.evaluatePortfolioRelevance(item.text, item.title, portfolio.id);

    const expType = item.expectedRelevanceType;
    const predType = analysis.relevanceType;

    relevanceTargets.push(expType);
    relevancePredictions.push(predType);

    if (expType === predType) {
      correctRelevanceType++;
    }

    // False Direct Match tracking
    if (predType === 'DIRECT') {
      totalDirectEvaluations++;
      if (expType !== 'DIRECT') {
        falseDirectMatches++;
        console.log(`[FALSE DIRECT MATCH DETECTED] Title: "${item.title}" | Expected: ${expType} | Got: DIRECT`);
      }
    }

    // Entity Precision/Recall/F1
    const expEntities = new Set<string>(item.expectedEntities || []);
    const predEntities = new Set<string>(analysis.resolvedEntities.map(e => e.canonicalName));

    for (const pEnt of predEntities) {
      if (expEntities.has(pEnt)) {
        entityTP++;
      } else {
        entityFP++;
      }
    }
    for (const eEnt of expEntities) {
      if (!predEntities.has(eEnt)) {
        entityFN++;
      }
    }

    // Asset Precision/Recall/F1
    const expAssets = new Set<string>(item.expectedAssets || []);
    const predAssets = new Set<string>(analysis.affectedAssets || []);

    for (const pAsset of predAssets) {
      if (expAssets.has(pAsset)) {
        assetTP++;
      } else {
        assetFP++;
      }
    }
    for (const eAsset of expAssets) {
      if (!predAssets.has(eAsset)) {
        assetFN++;
      }
    }
  }

  // Calculate Metrics
  const relevanceAccuracy = correctRelevanceType / benchmark.length;
  const falseDirectMatchRate = totalDirectEvaluations > 0 ? (falseDirectMatches / totalDirectEvaluations) : 0.0;

  const entityPrecision = entityTP + entityFP > 0 ? entityTP / (entityTP + entityFP) : 1.0;
  const entityRecall = entityTP + entityFN > 0 ? entityTP / (entityTP + entityFN) : 1.0;
  const entityF1 = entityPrecision + entityRecall > 0 ? (2 * entityPrecision * entityRecall) / (entityPrecision + entityRecall) : 0.0;

  const assetPrecision = assetTP + assetFP > 0 ? assetTP / (assetTP + assetFP) : 1.0;
  const assetRecall = assetTP + assetFN > 0 ? assetTP / (assetTP + assetFN) : 1.0;
  const assetF1 = assetPrecision + assetRecall > 0 ? (2 * assetPrecision * assetRecall) / (assetPrecision + assetRecall) : 0.0;

  // Macro F1 for Relevance Classification
  const categories = ['DIRECT', 'INDIRECT', 'PORTFOLIO_WIDE', 'IRRELEVANT'];
  let macroF1Sum = 0;

  for (const cat of categories) {
    let tp = 0, fp = 0, fn = 0;
    for (let i = 0; i < benchmark.length; i++) {
      if (relevancePredictions[i] === cat && relevanceTargets[i] === cat) tp++;
      else if (relevancePredictions[i] === cat && relevanceTargets[i] !== cat) fp++;
      else if (relevancePredictions[i] !== cat && relevanceTargets[i] === cat) fn++;
    }
    const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
    const rec = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0;
    macroF1Sum += f1;
  }
  const relevanceMacroF1 = macroF1Sum / categories.length;

  console.log('\n========================================');
  console.log('PHASE 3 EVALUATION SUMMARY RESULTS');
  console.log('========================================');
  console.log(`Relevance Accuracy: ${(relevanceAccuracy * 100).toFixed(2)}%`);
  console.log(`Relevance Macro F1: ${(relevanceMacroF1 * 100).toFixed(2)}%`);
  console.log(`Entity Precision: ${(entityPrecision * 100).toFixed(2)}%`);
  console.log(`Entity Recall: ${(entityRecall * 100).toFixed(2)}%`);
  console.log(`Entity F1: ${(entityF1 * 100).toFixed(2)}%`);
  console.log(`Asset Precision: ${(assetPrecision * 100).toFixed(2)}%`);
  console.log(`Asset Recall: ${(assetRecall * 100).toFixed(2)}%`);
  console.log(`Asset F1: ${(assetF1 * 100).toFixed(2)}%`);
  console.log(`False DIRECT Match Rate: ${(falseDirectMatchRate * 100).toFixed(2)}% (Target: < 2.0%)`);

  const results = {
    benchmark_size: benchmark.length,
    relevance_accuracy: Number(relevanceAccuracy.toFixed(4)),
    relevance_macro_f1: Number(relevanceMacroF1.toFixed(4)),
    entity_precision: Number(entityPrecision.toFixed(4)),
    entity_recall: Number(entityRecall.toFixed(4)),
    entity_f1: Number(entityF1.toFixed(4)),
    asset_precision: Number(assetPrecision.toFixed(4)),
    asset_recall: Number(assetRecall.toFixed(4)),
    asset_f1: Number(assetF1.toFixed(4)),
    false_direct_match_rate: Number(falseDirectMatchRate.toFixed(4)),
    pass_safety_target: falseDirectMatchRate < 0.02
  };

  const outputPath = path.resolve(__dirname, '..', 'ml', 'phase3_evaluation_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nSaved Evaluation Results to: ${outputPath}`);
}

evaluateEntityResolver().catch(err => {
  console.error('Evaluation failed:', err);
  process.exit(1);
});
