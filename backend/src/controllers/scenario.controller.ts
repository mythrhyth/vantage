import { Request, Response } from 'express';
import { scenarioService } from '../services/scenarios/scenario.service';

export class ScenarioController {
  async getScenarios(req: Request, res: Response) {
    try {
      const scenarios = await scenarioService.getScenarios();
      res.json(scenarios);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async getScenarioById(req: Request, res: Response) {
    try {
      const scenario = await scenarioService.getScenarioById(req.params.id);
      if (!scenario) {
        return res.status(404).json({ error: { message: 'Scenario not found' } });
      }
      res.json(scenario);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }
}

export const scenarioController = new ScenarioController();
