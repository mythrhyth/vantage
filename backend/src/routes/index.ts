import { Router } from 'express';
import eventRoutes from './event.routes';
import ingestionRoutes from './ingestion.routes';
import portfolioRoutes from './portfolio.routes';
import allocationRoutes from './allocation.routes';
import stressTestRoutes from './stress-test.routes';
import scenarioRoutes from './scenario.routes';

const router = Router();

// Domain Route Composition
router.use('/events', eventRoutes);
router.use('/', ingestionRoutes);
router.use('/', portfolioRoutes);
router.use('/', allocationRoutes);
router.use('/', stressTestRoutes);
router.use('/', scenarioRoutes);

export default router;
