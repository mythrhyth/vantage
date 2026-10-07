import { NlpService } from '../src/providers/nlp/nlp.service';
import { GeminiNlpProvider } from '../src/providers/nlp/gemini-nlp.provider';
import { DevelopmentNlpProvider } from '../src/providers/nlp/development-nlp.provider';

async function runProviderTests() {
  console.log('--- PROVIDER TESTS ---');

  // Test 1: NLP_PROVIDER=development -> DevelopmentNlpProvider
  process.env.NLP_PROVIDER = 'development';
  let service = new NlpService();
  if ((service as any).provider instanceof DevelopmentNlpProvider) {
    console.log('[PASS] NLP_PROVIDER=development initializes DevelopmentNlpProvider');
  } else {
    console.log('[FAIL] NLP_PROVIDER=development did not initialize DevelopmentNlpProvider');
  }

  // Test 2: NLP_PROVIDER=gemini without API key
  process.env.NLP_PROVIDER = 'gemini';
  delete process.env.GEMINI_API_KEY;
  try {
    new NlpService();
    console.log('[FAIL] Expected GeminiNlpProvider to throw without API key');
  } catch (e: any) {
    if (e.message.includes('GEMINI_API_KEY environment variable is not configured')) {
      console.log('[PASS] Missing GEMINI_API_KEY throws appropriate error');
    } else {
      console.log('[FAIL] Unexpected error:', e.message);
    }
  }

  // Test 3: NLP_PROVIDER=gemini with API key
  process.env.GEMINI_API_KEY = 'fake-key';
  try {
    service = new NlpService();
    if ((service as any).provider instanceof GeminiNlpProvider) {
      console.log('[PASS] NLP_PROVIDER=gemini initializes GeminiNlpProvider');
    } else {
      console.log('[FAIL] NLP_PROVIDER=gemini did not initialize GeminiNlpProvider');
    }
  } catch (e: any) {
    console.log('[FAIL] Failed to initialize Gemini provider:', e.message);
  }
  
  process.exit(0);
}

runProviderTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
