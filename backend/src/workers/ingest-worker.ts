import { ingestionService } from '../services/ingestion/ingestion.service';

const INTERVAL_MS = parseInt(process.env.INGESTION_INTERVAL_MS || '900000', 10); // 15 mins default

async function cycle() {
  console.log(`[IngestionWorker] Starting scheduled ingestion cycle at ${new Date().toISOString()}`);
  try {
    await ingestionService.runIngestion('LAST_24_HOURS');
  } catch (err: any) {
    console.error('[IngestionWorker] Ingestion cycle error:', err.message);
  }
}

console.log(`[IngestionWorker] Background worker started. Interval: ${INTERVAL_MS / 1000} seconds.`);
cycle();
setInterval(cycle, INTERVAL_MS);
