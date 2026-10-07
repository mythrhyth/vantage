import { Router } from 'express';
import { stressTestController } from '../controllers/stress-test.controller';

const router = Router();

router.post('/stress-tests/generate-parameters', (req, res) => stressTestController.generateParameters(req, res));
router.post('/stress-tests/run', (req, res) => stressTestController.runStressTest(req, res));
router.get('/stress-tests/history', (req, res) => stressTestController.getHistory(req, res));
router.get('/stress-tests/:id', (req, res) => stressTestController.getRunById(req, res));

export default router;
