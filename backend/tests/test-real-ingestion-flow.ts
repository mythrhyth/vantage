import { nlpService } from '../src/providers/nlp/nlp.service';
import { finBertSentimentAnalyzer } from '../src/providers/nlp/finbert-sentiment.analyzer';
import { financialContextLayer } from '../src/providers/nlp/financial-context';
import { phase2EventClassifier } from '../src/providers/nlp/phase2-event-classifier';
import { prisma } from '../src/db';

async function runRealIngestionFlowTest() {
  console.log('================================================================');
  console.log('RUNNING REAL BACKEND INGESTION & RISK EVENT PERSISTENCE TEST');
  console.log('================================================================\n');

  const testTitle = "Federal Reserve officials raise benchmark interest rates by 50 bps";
  const testText = "Federal Reserve officials raised benchmark interest rates by 50 basis points to combat inflation. " +
    "Operating costs and debt servicing expenses escalated across consumer credit markets, forcing management to adjust rate projections.";
  const testSource = "Integration Test Wire";

  console.log('1. Direct FinBERT + Context Layer reference calculation:');
  const rawFinBert = await finBertSentimentAnalyzer.analyzeSentiment(testText);
  const expectedContext = financialContextLayer.analyze(testText, rawFinBert);
  console.log('Raw FinBERT Sentiment:', rawFinBert);
  console.log('Expected Context Result:', expectedContext);

  console.log('\n2. Direct Phase 2 Event Classifier reference calculation:');
  const expectedPhase2 = await phase2EventClassifier.classifyEvent(testText);
  console.log('Expected Phase 2 Result:', expectedPhase2);

  console.log('\n3. Executing real backend nlpService.analyzeAndPersist flow...');
  const riskEvent = await nlpService.analyzeAndPersist(
    {
      title: testTitle,
      source: testSource,
      publishedAt: new Date().toISOString(),
      excerpt: testText.substring(0, 200)
    },
    testText,
    {
      relevant: true,
      relevanceType: "PORTFOLIO_WIDE",
      affectedAssets: ["FED"],
      portfolioWide: true,
      relevanceScore: 0.95,
      relevanceReason: "Federal Reserve rate hike macroeconomic impact"
    }
  );

  console.log('\n4. RiskEvent created in backend pipeline:', {
    id: riskEvent.id,
    title: riskEvent.title,
    entity: riskEvent.entity,
    category: riskEvent.category,
    classification_confidence: riskEvent.classification_confidence,
    sentiment: riskEvent.sentiment,
    sentiment_confidence: riskEvent.sentiment_confidence,
    source: riskEvent.source
  });

  console.log('\n5. Fetching RiskEvent directly from PostgreSQL database via Prisma...');
  const dbEvent = await prisma.riskEvent.findUnique({
    where: { id: riskEvent.id }
  });

  if (!dbEvent) {
    console.error('✗ FAILED: RiskEvent was not found in PostgreSQL database');
    process.exit(1);
  }

  console.log('Retrieved RiskEvent from DB:', {
    id: dbEvent.id,
    category: dbEvent.category,
    classification_confidence: dbEvent.classification_confidence,
    sentiment: dbEvent.sentiment,
    sentiment_confidence: dbEvent.sentiment_confidence,
    source: dbEvent.source,
    created_at: dbEvent.created_at
  });

  // Verification checks
  const sentimentMatch = Math.abs(Number(dbEvent.sentiment) - expectedContext.adjustedSentiment) < 0.001;
  const confidenceMatch = Math.abs(Number(dbEvent.sentiment_confidence) - expectedContext.adjustedConfidence) < 0.001;
  const categoryMatch = dbEvent.category === expectedPhase2.predictedCategory;
  const classConfidenceMatch = Math.abs(Number(dbEvent.classification_confidence) - expectedPhase2.confidence) < 0.001;

  if (sentimentMatch && confidenceMatch && categoryMatch && classConfidenceMatch) {
    console.log('\n✓ SUCCESS: RiskEvent category, classification_confidence, sentiment, and sentiment_confidence in PostgreSQL database strictly originated from fine-tuned Phase 2 Event Classifier & Phase 1D FinBERT pipeline!');
  } else {
    console.error('\n✗ FAILED: Database RiskEvent fields did not match expected fine-tuned models:', {
      dbCategory: dbEvent.category,
      expectedCategory: expectedPhase2.predictedCategory,
      dbClassConfidence: dbEvent.classification_confidence,
      expectedClassConfidence: expectedPhase2.confidence,
      dbSentiment: dbEvent.sentiment,
      expectedSentiment: expectedContext.adjustedSentiment,
      dbConfidence: dbEvent.sentiment_confidence,
      expectedConfidence: expectedContext.adjustedConfidence
    });
    process.exit(1);
  }

  // Clean up created test RiskEvent
  console.log('\n6. Cleaning up integration test record from PostgreSQL database...');
  await prisma.riskEvent.delete({
    where: { id: dbEvent.id }
  });
  console.log('Cleanup complete.');

  console.log('\n================================================================');
  console.log('REAL BACKEND INGESTION FLOW TEST PASSED SUCCESSFULLY!');
  console.log('================================================================\n');

  process.exit(0);
}

runRealIngestionFlowTest().catch(err => {
  console.error('Fatal real ingestion test error:', err);
  process.exit(1);
});
