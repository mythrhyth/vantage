import { Router } from 'express';
import { allocationController } from '../controllers/allocation.controller';

const router = Router();

router.post('/allocations/simulate', (req, res) => allocationController.simulateAllocation(req, res));
router.get('/allocations/history', (req, res) => allocationController.getAllocationHistory(req, res));
router.post('/allocations/apply', (req, res) => allocationController.applyAllocation(req, res));

export default router;

