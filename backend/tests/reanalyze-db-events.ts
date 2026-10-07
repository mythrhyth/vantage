import { prisma } from '../src/server';
import { DevelopmentNlpProvider } from '../src/providers/nlp/development-nlp.provider';

async function reanalyzeAll() {
  const provider = new DevelopmentNlpProvider();
  const events = await prisma.riskEvent.findMany();
  console.log(`Re-evaluating ${events.length} events in database...`);

  let count = 0;
  for (const event of events) {
    const analysis = await provider.analyze({
      text: event.title + '. ' + (event.excerpt || ''),
      source: event.source
    });

    await prisma.riskEvent.update({
      where: { id: event.id },
      data: {
        entity: analysis.entity,
        category: analysis.classification,
        sentiment: analysis.sentiment,
        impact: analysis.impact,
        impact_reason: analysis.impactReason,
        classification_reason: analysis.classificationReason,
        sentiment_drivers: analysis.sentimentDrivers as any,
        impact_factors: analysis.impactFactors as any,
        affected_areas: analysis.affectedAreas as any,
        signals: analysis.signals as any
      }
    });
    count++;
  }

  console.log(`✅ Successfully re-evaluated and updated ${count} events in database.`);
}

reanalyzeAll().then(() => process.exit(0)).catch(e => {
  console.error('Re-evaluation error:', e);
  process.exit(1);
});
