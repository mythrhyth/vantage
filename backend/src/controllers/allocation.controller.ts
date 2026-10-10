import { Request, Response } from 'express';
import { allocationService } from '../services/allocations/allocation.service';

export class AllocationController {
  async simulateAllocation(req: Request, res: Response) {
    try {
      const { portfolio_id, sensitivity, maxWeight, maxChange, sectorLimit } = req.body;
      if (!portfolio_id) {
        return res.status(400).json({ error: { message: 'portfolio_id is required' } });
      }

      const sens = sensitivity !== undefined ? parseFloat(sensitivity) : 50;
      const maxW = maxWeight !== undefined ? parseFloat(maxWeight) : 14;
      const maxC = maxChange !== undefined ? parseFloat(maxChange) : 2.0;
      const secL = sectorLimit !== undefined ? parseFloat(sectorLimit) : 40;

      const result = await allocationService.simulateAllocation(portfolio_id, sens, maxW, maxC, secL);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }
}

export const allocationController = new AllocationController();
