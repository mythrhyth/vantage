import { ingestionService } from '../src/ingestion/ingestion.service';

async function main() {
  console.log('==================================================');
  console.log('RUNNING MULTI-SOURCE LIVE INGESTION CYCLE');
  console.log('==================================================');

  try {
    const stats = await ingestionService.runIngestion('LAST_7_DAYS');
    console.log('\nLIVE INGESTION EXECUTION SUMMARY:');
    console.log(JSON.stringify(stats, null, 2));
  } catch (err: any) {
    console.error('Live ingestion error:', err.message);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
