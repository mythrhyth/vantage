import { Router } from 'express';
import { eventController } from '../controllers/event.controller';

const router = Router();

router.get('/', (req, res) => eventController.listEvents(req, res));
router.get('/:id', (req, res) => eventController.getEventById(req, res));
router.post('/analyze', (req, res) => eventController.analyzeEvent(req, res));

export default router;
