import { ingestionService } from './ingestion.service';
import { RssIngestionSource } from './rss-source';
import { CnbcIngestionSource } from './cnbc-source';

async function ingestOnce() {
  console.log(`[IngestOnce] Running a single ingestion cycle...`);
  await ingestionService.runIngestion();
  console.log(`[IngestOnce] Cycle complete.`);
}

ingestOnce()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
