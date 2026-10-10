import { Request, Response } from 'express';
import { riskEngineService } from '../services/risk-engine/risk-engine.service';
import { scenarioService } from '../services/scenarios/scenario.service';

export class StressTestController {
  async generateParameters(req: Request, res: Response) {
    try {
      const { event_id, scenario_id } = req.body;
      if (!event_id || !scenario_id) {
        return res.status(400).json({ error: { message: 'Missing event_id or scenario_id' } });
      }

      const params = await scenarioService.generateEventStressParameters(event_id, scenario_id);
      res.json(params);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async runStressTest(req: Request, res: Response) {
    try {
      const { portfolio_id, scenario_id, event_id, parameters, persist, run_type } = req.body;
      if (!portfolio_id) {
        return res.status(400).json({ error: { message: 'portfolio_id is required' } });
      }

      const shouldPersist = persist !== undefined ? Boolean(persist) : true;
      const result = await riskEngineService.runStressTest(
        portfolio_id,
        parameters || {},
        scenario_id,
        event_id,
        shouldPersist,
        run_type
      );
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async getHistory(req: Request, res: Response) {
    try {
      const history = await riskEngineService.getHistory();
      res.json(history);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async getRunById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!id || !uuidRegex.test(id)) {
        return res.status(400).json({ error: { message: 'Invalid run ID format' } });
      }

      const run = await riskEngineService.getRunById(id);
      if (!run) {
        return res.status(404).json({ error: { message: 'Stress test run not found' } });
      }
      res.json(run);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }
}

export const stressTestController = new StressTestController();
