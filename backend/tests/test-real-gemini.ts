import dotenv from 'dotenv';
dotenv.config();

import { nlpService } from '../src/providers/nlp/nlp.service';
import { EventService } from '../src/services/events/event.service';

const eventService = new EventService();

async function runGeminiVerification() {
  console.log('--- STARTING REAL GEMINI VERIFICATION ---');
  console.log(`Using NLP_PROVIDER: ${process.env.NLP_PROVIDER}`);
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY is still not configured.');
    process.exit(1);
  }

  const examples = [
    {
      name: 'Monetary policy',
      text: "Federal Reserve officials signaled that interest rates could remain elevated for longer as inflation continues to exceed the central bank's target.",
      source: "Gemini Test Run"
    },
    {
      name: 'Credit event',
      text: "A major corporation missed an interest payment, raising concerns about its ability to meet upcoming debt obligations.",
      source: "Gemini Test Run"
    },
    {
      name: 'M&A',
      text: "A large technology company announced an agreement to acquire a smaller AI company for $8 billion.",
      source: "Gemini Test Run"
    }
  ];

  for (const example of examples) {
    console.log(`\n\n=== Evaluating Example: ${example.name} ===`);
    try {
      // 1. Validate & Persist
      const riskEvent = await nlpService.analyzeAndPersist(example.text, example.source);
      console.log('[PASS] Gemini Raw/Parsed Result successfully validated and persisted.');
      console.log(`       -> Event ID: ${riskEvent.id}`);
      console.log(`       -> Classification: ${riskEvent.category}`);
      console.log(`       -> Sentiment: ${riskEvent.sentiment}`);
      console.log(`       -> Impact: ${riskEvent.impact}`);

      // 2. Retrieve from PostgreSQL / Verify via GET logic
      const retrieved = await eventService.getEventById(riskEvent.id);
      if (retrieved) {
        console.log('[PASS] Event successfully retrieved from PostgreSQL.');
        console.log(`       -> Affected Entity: ${retrieved.entity}`);
        console.log(`       -> Classification Reason: ${retrieved.classificationReason}`);
        console.log(`       -> Impact Reason: ${retrieved.impactReason}`);
        
        console.log('\n       --- Full Structured Data ---');
        console.log(JSON.stringify(retrieved, null, 2));
      } else {
        console.log('[FAIL] Could not retrieve event from PostgreSQL.');
      }
    } catch (e: any) {
      console.error(`[FAIL] Error processing example:`, e.message);
    }
  }

  console.log('\n--- VERIFICATION COMPLETE ---');
  process.exit(0);
}

runGeminiVerification().catch(e => {
  console.error(e);
  process.exit(1);
});
