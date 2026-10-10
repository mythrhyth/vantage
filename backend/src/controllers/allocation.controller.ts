import { Request, Response } from 'express';
import { allocationService } from '../services/allocations/allocation.service';
import { portfolioService } from '../services/portfolios/portfolio.service';

export class AllocationController {
  async simulateAllocation(req: Request, res: Response) {
    try {
      const { portfolio_id, sensitivity, maxWeight, maxChange, sectorLimit, frequency, transactionCostBps } = req.body;
      if (!portfolio_id) {
        return res.status(400).json({ error: { message: 'portfolio_id is required' } });
      }

      const sensVal = sensitivity !== undefined ? parseFloat(sensitivity) : 50;
      const maxWVal = maxWeight !== undefined ? parseFloat(maxWeight) : 14;
      const maxCVal = maxChange !== undefined ? parseFloat(maxChange) : 2.0;
      const secLVal = sectorLimit !== undefined ? parseFloat(sectorLimit) : 38;
      const bpsVal = transactionCostBps !== undefined ? parseFloat(transactionCostBps) : 12;

      const sens = isNaN(sensVal) ? 50 : sensVal;
      const maxW = isNaN(maxWVal) ? 14 : maxWVal;
      const maxC = isNaN(maxCVal) ? 2.0 : maxCVal;
      const secL = isNaN(secLVal) ? 38 : secLVal;
      const freq = frequency || 'Weekly';
      const bps = isNaN(bpsVal) ? 12 : bpsVal;

      const result = await allocationService.simulateAllocation(
        portfolio_id,
        sens,
        maxW,
        maxC,
        secL,
        freq,
        bps,
        false
      );
      res.json(result);
    } catch (e: any) {
      if (e.message === 'Portfolio not found') {
        return res.status(404).json({ error: { message: 'Portfolio not found' } });
      }
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async getAllocationHistory(req: Request, res: Response) {
    try {
      const portfolioId = (req.query.portfolio_id || req.query.portfolioId) as string;
      if (!portfolioId) {
        return res.status(400).json({ error: { message: 'portfolio_id query parameter is required' } });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const history = await allocationService.getAllocationHistory(portfolioId, isNaN(limit) ? 20 : limit);
      res.json(history);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async applyAllocation(req: Request, res: Response) {
    try {
      const { portfolio_id, sensitivity, maxWeight, maxChange, sectorLimit, frequency, transactionCostBps } = req.body;
      if (!portfolio_id) {
        return res.status(400).json({ error: { message: 'portfolio_id is required' } });
      }

      const sensVal = sensitivity !== undefined ? parseFloat(sensitivity) : 50;
      const maxWVal = maxWeight !== undefined ? parseFloat(maxWeight) : 14;
      const maxCVal = maxChange !== undefined ? parseFloat(maxChange) : 2.0;
      const secLVal = sectorLimit !== undefined ? parseFloat(sectorLimit) : 38;
      const bpsVal = transactionCostBps !== undefined ? parseFloat(transactionCostBps) : 12;

      const sens = isNaN(sensVal) ? 50 : sensVal;
      const maxW = isNaN(maxWVal) ? 14 : maxWVal;
      const maxC = isNaN(maxCVal) ? 2.0 : maxCVal;
      const secL = isNaN(secLVal) ? 38 : secLVal;
      const freq = frequency || 'Weekly';
      const bps = isNaN(bpsVal) ? 12 : bpsVal;

      // Run simulation marked as applied
      const simResult = await allocationService.simulateAllocation(
        portfolio_id,
        sens,
        maxW,
        maxC,
        secL,
        freq,
        bps,
        true
      );

      if (simResult.trace.optimizerStatus === 'INFEASIBLE') {
        return res.status(400).json({
          error: { message: simResult.trace.infeasibilityReason || 'Allocation constraints are infeasible' }
        });
      }

      // Update actual holdings in database
      const newHoldings = simResult.proposed_weights.map(item => ({
        ticker: item.ticker,
        company: item.company,
        currentWeight: item.proposedWeight,
        sector: item.sector
      }));

      await portfolioService.updateHoldings(portfolio_id, newHoldings);

      res.json({
        success: true,
        message: 'Proposed allocation successfully applied to portfolio holdings and persisted to history',
        runId: simResult.runId,
        result: simResult
      });
    } catch (e: any) {
      if (e.message === 'Portfolio not found') {
        return res.status(404).json({ error: { message: 'Portfolio not found' } });
      }
      res.status(500).json({ error: { message: e.message } });
    }
  }
}

export const allocationController = new AllocationController();

