import { prisma } from '../src/server';
import { finBertSentimentAnalyzer } from '../src/providers/nlp/finbert-sentiment.analyzer';
import { GeminiNlpProvider } from '../src/providers/nlp/gemini-nlp.provider';

async function runComparison() {
  console.log('==================================================');
  console.log('COMPARING FINBERT VS GEMINI ON 10 REAL DB ARTICLES');
  console.log('==================================================\n');

  const dbEvents = await prisma.riskEvent.findMany({
    orderBy: { created_at: 'desc' },
    take: 10
  });

  if (dbEvents.length === 0) {
    console.log('No events found in database to evaluate.');
    process.exit(0);
  }

  let geminiProvider: GeminiNlpProvider | null = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      geminiProvider = new GeminiNlpProvider();
    } catch (e) {
      console.warn('Could not initialize Gemini provider for evaluation comparison.');
    }
  }

  const comparisonTable: any[] = [];

  for (let idx = 0; idx < dbEvents.length; idx++) {
    const event = dbEvents[idx];
    const textToAnalyze = `${event.title}. ${event.excerpt || ''}`;

    // 1. Run FinBERT Analyzer
    const finbertResult = await finBertSentimentAnalyzer.analyzeSentiment(textToAnalyze);

    // 2. Run Gemini (if API key available)
    let geminiSentiment = 'N/A';
    let geminiConfidence = 'N/A';
    let geminiLabel = 'N/A';

    if (geminiProvider) {
      try {
        const geminiAnalysis = await geminiProvider.analyze({
          text: textToAnalyze,
          source: event.source
        });
        geminiSentiment = (geminiAnalysis.sentiment >= 0 ? '+' : '') + geminiAnalysis.sentiment.toFixed(2);
        geminiConfidence = geminiAnalysis.sentimentConfidence ? (geminiAnalysis.sentimentConfidence * 100).toFixed(0) + '%' : 'N/A';
        geminiLabel = geminiAnalysis.sentiment > 0.05 ? 'positive' : geminiAnalysis.sentiment < -0.05 ? 'negative' : 'neutral';
      } catch (e: any) {
        geminiSentiment = `Err: ${e.message.substring(0, 15)}`;
      }
    }

    comparisonTable.push({
      "#": idx + 1,
      Title: event.title.length > 40 ? event.title.substring(0, 37) + '...' : event.title,
      "FinBERT Score": (finbertResult.sentiment >= 0 ? '+' : '') + finbertResult.sentiment.toFixed(4),
      "FinBERT Label": finbertResult.label,
      "FinBERT Conf": (finbertResult.confidence * 100).toFixed(1) + '%',
      "Gemini Score": geminiSentiment,
      "Gemini Label": geminiLabel,
      "Gemini Conf": geminiConfidence
    });
  }

  console.table(comparisonTable);
  console.log('\n✅ FinBERT vs Gemini side-by-side evaluation complete.');
  process.exit(0);
}

runComparison().catch(e => {
  console.error('Comparison script error:', e);
  process.exit(1);
});
