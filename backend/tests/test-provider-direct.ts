import { GeminiNlpProvider } from '../src/services/nlp/gemini-nlp.provider';

async function run() {
  process.env.GEMINI_API_KEY = 'fake-key';
  
  try {
    const provider = new GeminiNlpProvider();
    console.log('[PASS] Instantiated GeminiNlpProvider successfully');
  } catch (e: any) {
    console.error('[FAIL] Could not instantiate', e.message);
  }
}

run().catch(console.error);
