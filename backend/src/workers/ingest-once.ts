import { ingestionService } from '../services/ingestion/ingestion.service';

async function main() {
  console.log('[Worker] Running manual ingestion cycle...');
  const res = await ingestionService.runIngestion('LAST_24_HOURS');
  console.log('[Worker] Result:', JSON.stringify(res, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});
