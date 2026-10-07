import { Router } from 'express';
import { ApiController } from '../controllers/api.controller';

const router = Router();

// Events & Ingestion
router.get('/events', ApiController.getEvents);
router.post('/events/analyze', ApiController.analyzeEvent);
router.get('/events/:id', ApiController.getEvent);
router.post('/ingest', ApiController.runIngestion);

// Sources & Settings
router.get('/ingestion/sources', ApiController.getSources);
router.post('/ingestion/sources', ApiController.addSource);
router.patch('/ingestion/sources/:id', ApiController.updateSource);
router.delete('/ingestion/sources/:id', ApiController.deleteSource);
router.get('/ingestion/settings', ApiController.getSettings);
router.patch('/ingestion/settings', ApiController.updateSettings);

// Portfolio
router.get('/portfolios', ApiController.getPortfolios);
router.get('/portfolios/:id', ApiController.getPortfolio);
router.put('/portfolios/:id', ApiController.updatePortfolio);
router.put('/portfolios/:id/holdings', ApiController.updateHoldings);
router.get('/portfolio/:id/assets', ApiController.getPortfolioAssets);

// Scenarios
router.get('/scenarios', ApiController.getScenarios);
router.get('/scenarios/:id', ApiController.getScenario);

// Allocations
router.post('/allocations/simulate', ApiController.simulateAllocation);

// Stress Tests
router.post('/stress-tests/generate-parameters', ApiController.generateParameters);
router.post('/stress-tests/run', ApiController.runStressTest);
router.get('/stress-tests/history', ApiController.getStressHistory);
router.get('/stress-tests/:id', ApiController.getStressRun);

export default router;
