import { Router } from 'express';
import { allocationController } from '../controllers/allocation.controller';

const router = Router();

router.post('/allocations/simulate', (req, res) => allocationController.simulateAllocation(req, res));

export default router;
