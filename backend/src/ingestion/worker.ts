import { ingestionService } from './ingestion.service';
import { RssIngestionSource } from './rss-source';
import { CnbcIngestionSource } from './cnbc-source';

let isRunning = false;

async function startWorker() {
  const sources = [new RssIngestionSource(), new CnbcIngestionSource()];
  const intervalMinutes = process.env.INGESTION_INTERVAL_MINUTES ? parseInt(process.env.INGESTION_INTERVAL_MINUTES) : 5;

  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[Worker] Starting ingestion worker. Polling every ${intervalMinutes} minutes.`);

  const run = async () => {
    if (isRunning) {
      console.log('[Worker] Previous cycle still running. Skipping this cycle.');
      return;
    }
    isRunning = true;
    try {
      await ingestionService.runIngestion();
    } catch (e) {
      console.error('[Worker] Error in ingestion cycle:', e);
    } finally {
      isRunning = false;
    }
  };

  // Run once immediately
  await run();

  setInterval(run, intervalMs);
}

// Ensure the process isn't terminated if errors happen
process.on('uncaughtException', (err) => {
  console.error('[Worker] Uncaught Exception:', err);
});

startWorker();
