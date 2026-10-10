import { Request, Response } from 'express';
import { allocationService } from '../services/allocations/allocation.service';

export class AllocationController {
  async simulateAllocation(req: Request, res: Response) {
    try {
      const { portfolio_id, sensitivity, maxWeight, maxChange, sectorLimit } = req.body;
      if (!portfolio_id) {
        return res.status(400).json({ error: { message: 'portfolio_id is required' } });
      }

      const sensVal = sensitivity !== undefined ? parseFloat(sensitivity) : 50;
      const maxWVal = maxWeight !== undefined ? parseFloat(maxWeight) : 14;
      const maxCVal = maxChange !== undefined ? parseFloat(maxChange) : 2.0;
      const secLVal = sectorLimit !== undefined ? parseFloat(sectorLimit) : 40;

      const sens = isNaN(sensVal) ? 50 : sensVal;
      const maxW = isNaN(maxWVal) ? 14 : maxWVal;
      const maxC = isNaN(maxCVal) ? 2.0 : maxCVal;
      const secL = isNaN(secLVal) ? 40 : secLVal;

      const result = await allocationService.simulateAllocation(portfolio_id, sens, maxW, maxC, secL);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }
}

export const allocationController = new AllocationController();
