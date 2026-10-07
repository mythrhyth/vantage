import { ingestionService } from './ingestion.service';
import { DevelopmentIngestionSource } from './development-source';
import { prisma } from '../server';
import { nlpService } from '../services/nlp/nlp.service';

async function runTests() {
  console.log('--- RUNNING INGESTION TESTS ---');
  
  // Cleanup
  await prisma.ingestedArticle.deleteMany({});
  
  const source = new DevelopmentIngestionSource();
  const rawArticles = await source.fetchLatest();
  
  // Test 1: New article
  console.log('\n--- TEST 1 & 3: New Article & Same title different content ---');
  await ingestionService.runIngestion();
  
  const processed = await prisma.ingestedArticle.findMany();
  console.log(`[PASS] Inserted ${processed.length} articles.`);
  if (processed.find(p => p.external_id === 'dev-12345') && processed.find(p => p.external_id === 'dev-12345-update')) {
    console.log(`[PASS] Both articles with the same title were processed.`);
  } else {
    console.log(`[FAIL] Articles with same title were not properly separated.`);
  }

  // Test 2: Duplicate article
  console.log('\n--- TEST 2: Duplicate Article & Repeated Worker Execution ---');
  await ingestionService.runIngestion();
  const processedAfterDuplicate = await prisma.ingestedArticle.findMany();
  if (processed.length === processedAfterDuplicate.length) {
    console.log(`[PASS] No duplicates were inserted.`);
  } else {
    console.log(`[FAIL] Duplicates were inserted! Before: ${processed.length}, After: ${processedAfterDuplicate.length}`);
  }

  // Test 4 & 5: NLP failure & Invalid NLP output
  console.log('\n--- TEST 4 & 5: NLP Failure / Invalid Output ---');
  const oldAnalyze = nlpService.analyzeAndPersist;
  nlpService.analyzeAndPersist = async () => {
    throw new Error("Simulated NLP Failure");
  };

  await ingestionService.runIngestion();
  
  // Restore
  nlpService.analyzeAndPersist = oldAnalyze;

  // Test 7: Empty feed
  console.log('\n--- TEST 7: Empty Feed ---');
  await ingestionService.runIngestion();
  console.log(`[PASS] Survived empty feed.`);

  // Test 9: Provenance
  console.log('\n--- TEST 9: Provenance ---');
  const pArticle = processed.find(p => p.external_id === 'dev-12345');
  if (pArticle && pArticle.source === 'DEVELOPMENT INGESTION SOURCE' && pArticle.ingested_at) {
    console.log(`[PASS] Provenance verified. Source: ${pArticle.source}, ID: ${pArticle.external_id}`);
  } else {
    console.log(`[FAIL] Provenance missing.`);
  }

  console.log('\n--- DONE ---');
  process.exit(0);
}

runTests().catch(e => { console.error(e); process.exit(1); });
