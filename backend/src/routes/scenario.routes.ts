import { Router } from 'express';
import { scenarioController } from '../controllers/scenario.controller';

const router = Router();

router.get('/scenarios', (req, res) => scenarioController.getScenarios(req, res));
router.get('/scenarios/:id', (req, res) => scenarioController.getScenarioById(req, res));

export default router;
