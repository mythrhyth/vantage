import { finBertSentimentAnalyzer } from '../src/providers/nlp/finbert-sentiment.analyzer';

interface EvaluationItem {
  text: string;
  humanLabel: 'positive' | 'negative' | 'neutral';
  context?: string;
}

const EVALUATION_DATASET: EvaluationItem[] = [
  {
    text: "Nvidia quarterly profit jumps 120% as artificial intelligence chip demand accelerates.",
    humanLabel: "positive",
    context: "Tech earnings"
  },
  {
    text: "Commercial real estate default rates climb to highest level since 2010 financial crisis.",
    humanLabel: "negative",
    context: "Credit risk"
  },
  {
    text: "Federal Reserve Open Market Committee leaves benchmark federal funds target range unchanged at 5.25%-5.50%.",
    humanLabel: "neutral",
    context: "Monetary policy"
  },
  {
    text: "Major airline files for Chapter 11 bankruptcy protection after failing to restructure senior debt.",
    humanLabel: "negative",
    context: "Corporate bankruptcy"
  },
  {
    text: "Biotech firm receives FDA accelerated approval for breakthrough cancer immunotherapy treatment.",
    humanLabel: "positive",
    context: "Regulatory approval"
  },
  {
    text: "European Central Bank publishes monthly financial stability review report.",
    humanLabel: "neutral",
    context: "Central bank report"
  },
  {
    text: "Oil prices plummet 6% following unexpected surge in crude inventories and OPEC production quota increase.",
    humanLabel: "negative",
    context: "Commodities market"
  },
  {
    text: "Global logistics corporation expands warehouse network across three new logistics hubs.",
    humanLabel: "positive",
    context: "Corporate expansion"
  },
  {
    text: "Automaker issues voluntary recall for 150,000 electric vehicles due to battery software glitch.",
    humanLabel: "negative",
    context: "Product recall"
  },
  {
    text: "Treasury Department issues weekly auctions schedule for 2-year and 10-year note offerings.",
    humanLabel: "neutral",
    context: "Treasury auction"
  }
];

async function runEvaluation() {
  console.log('==================================================');
  console.log('EVALUATING FINBERT SENTIMENT ANALYZER ON LABELED DATASET');
  console.log('==================================================\n');

  let correct = 0;
  let totalConfidenceSum = 0;

  const confusionMatrix: Record<string, Record<string, number>> = {
    positive: { positive: 0, negative: 0, neutral: 0 },
    negative: { positive: 0, negative: 0, neutral: 0 },
    neutral: { positive: 0, negative: 0, neutral: 0 }
  };

  for (const item of EVALUATION_DATASET) {
    const result = await finBertSentimentAnalyzer.analyzeSentiment(item.text);
    const predicted = result.label;
    
    totalConfidenceSum += result.confidence;
    confusionMatrix[item.humanLabel][predicted]++;

    const isMatch = predicted === item.humanLabel;
    if (isMatch) correct++;

    console.log(`[${isMatch ? 'PASS' : 'FAIL'}] True: ${item.humanLabel.padEnd(8)} | Pred: ${predicted.padEnd(8)} | Score: ${(result.sentiment >= 0 ? '+' : '') + result.sentiment.toFixed(4)} | Conf: ${result.confidence.toFixed(4)} | Context: ${item.context}`);
  }

  const accuracy = (correct / EVALUATION_DATASET.length) * 100;
  const avgConfidence = totalConfidenceSum / EVALUATION_DATASET.length;

  console.log('\n==================================================');
  console.log('FINBERT EVALUATION METRICS');
  console.log('==================================================');
  console.log(`Total Evaluated Examples: ${EVALUATION_DATASET.length}`);
  console.log(`Accuracy:               ${accuracy.toFixed(1)}% (${correct}/${EVALUATION_DATASET.length})`);
  console.log(`Average Model Confidence: ${avgConfidence.toFixed(4)}`);
  console.log('\nConfusion Matrix (Rows: Ground Truth, Cols: Prediction):');
  console.table(confusionMatrix);

  process.exit(0);
}

runEvaluation().catch(e => {
  console.error('Evaluation script error:', e);
  process.exit(1);
});
