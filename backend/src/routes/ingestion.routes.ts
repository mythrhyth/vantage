import { Router } from 'express';
import { ingestionController } from '../controllers/ingestion.controller';

const router = Router();

router.post('/ingest', (req, res) => ingestionController.runIngestion(req, res));
router.get('/ingestion/sources', (req, res) => ingestionController.getSources(req, res));
router.patch('/ingestion/sources/:id', (req, res) => ingestionController.toggleSource(req, res));
router.put('/ingestion/sources/:id', (req, res) => ingestionController.updateSource(req, res));
router.get('/ingestion/settings', (req, res) => ingestionController.getSettings(req, res));
router.patch('/ingestion/settings', (req, res) => ingestionController.updateSettings(req, res));

export default router;
