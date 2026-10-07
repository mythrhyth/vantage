import { Request, Response, NextFunction } from 'express';
import { EventService } from '../services/event.service';
import { PortfolioService } from '../services/portfolio.service';
import { ScenarioService } from '../services/scenario.service';
import { AllocationService } from '../services/allocation.service';
import { RiskEngineService } from '../services/risk-engine.service';
import { nlpService } from '../services/nlp/nlp.service';
import { prisma } from '../db';

const eventService = new EventService();
const portfolioService = new PortfolioService();
const scenarioService = new ScenarioService();
const allocationService = new AllocationService();
const riskEngineService = new RiskEngineService();

export class ApiController {
  
  // Events
  static async getEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const { category, horizon, sentiment, impact, portfolioId, source, freshness } = req.query;
      
      const filters: any = {};
      if (category) filters.category = String(category);
      if (horizon) filters.horizon = String(horizon);
      if (portfolioId) filters.portfolioId = String(portfolioId);
      if (source) filters.source = String(source);
      if (freshness) filters.freshness = String(freshness);
      if (sentiment) {
        const s = Number(sentiment);
        if (s < -1 || s > 1) throw { status: 400, message: 'Invalid sentiment range (-1 to 1)' };
        filters.sentiment = s;
      }
      if (impact) {
        const i = Number(impact);
        if (i < 0 || i > 10) throw { status: 400, message: 'Invalid impact range (0 to 10)' };
        filters.impact = i;
      }

      const events = await eventService.listEvents(filters);
      res.json(events);
    } catch (e) { next(e); }
  }

  static async getEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const e = await eventService.getEventById(String(req.params.id));
      if (!e) throw { status: 404, message: 'Event not found' };
      res.json(e);
    } catch (e) { next(e); }
  }

  static async analyzeEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const { text, source, timestamp } = req.body;
      if (!text || text.trim() === '') {
        throw { status: 400, message: 'Missing or empty text' };
      }
      
      const event = await nlpService.analyzeAndPersist({
        title: 'Manual Input',
        source: source || 'Manual Input',
        publishedAt: timestamp || new Date().toISOString()
      }, text);
      const mappedEvent = await eventService.getEventById(event.id);
      res.json(mappedEvent);
    } catch (e: any) {
      if (e?.name === 'NlpValidationException') {
        return res.status(400).json({ error: { message: e.message } });
      }
      next(e);
    }
  }

  static async runIngestion(req: Request, res: Response, next: NextFunction) {
    try {
      const { ingestionService } = await import('../ingestion/ingestion.service');
      const { window } = req.body || {};
      const stats = await ingestionService.runIngestion(window);
      res.json({ success: true, message: 'Ingestion cycle completed successfully', stats });
    } catch (e) {
      next(e);
    }
  }

  // Sources & Settings
  static async getSources(req: Request, res: Response, next: NextFunction) {
    try {
      const { sourceManager } = await import('../ingestion/source-manager');
      const sources = await sourceManager.listSources();
      res.json(sources);
    } catch (e) { next(e); }
  }

  static async addSource(req: Request, res: Response, next: NextFunction) {
    try {
      const { sourceManager } = await import('../ingestion/source-manager');
      const source = await sourceManager.addSource(req.body);
      res.json(source);
    } catch (e) { next(e); }
  }

  static async updateSource(req: Request, res: Response, next: NextFunction) {
    try {
      const { sourceManager } = await import('../ingestion/source-manager');
      const source = await sourceManager.updateSource(String(req.params.id), req.body);
      res.json(source);
    } catch (e) { next(e); }
  }

  static async deleteSource(req: Request, res: Response, next: NextFunction) {
    try {
      const { sourceManager } = await import('../ingestion/source-manager');
      await sourceManager.deleteSource(String(req.params.id));
      res.json({ success: true, message: 'Source removed successfully' });
    } catch (e) { next(e); }
  }

  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { sourceManager } = await import('../ingestion/source-manager');
      const settings = await sourceManager.getSettings();
      res.json(settings);
    } catch (e) { next(e); }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { sourceManager } = await import('../ingestion/source-manager');
      const settings = await sourceManager.updateSettings(req.body);
      res.json(settings);
    } catch (e) { next(e); }
  }

  // Portfolio
  static async getPortfolios(req: Request, res: Response, next: NextFunction) {
    try {
      const portfolios = await portfolioService.listPortfolios();
      res.json(portfolios);
    } catch (e) { next(e); }
  }

  static async getPortfolio(req: Request, res: Response, next: NextFunction) {
    try {
      const portfolio = await portfolioService.getPortfolio(String(req.params.id));
      if (!portfolio) throw { status: 404, message: 'Portfolio not found' };
      res.json(portfolio);
    } catch (e) { next(e); }
  }

  static async updatePortfolio(req: Request, res: Response, next: NextFunction) {
    try {
      const portfolio = await portfolioService.updatePortfolio(String(req.params.id), req.body);
      res.json(portfolio);
    } catch (e) { next(e); }
  }

  static async updateHoldings(req: Request, res: Response, next: NextFunction) {
    try {
      const holdings = req.body.holdings ?? req.body;
      const portfolio = await portfolioService.updateHoldings(String(req.params.id), holdings);
      res.json(portfolio);
    } catch (e) { next(e); }
  }

  static async getPortfolioAssets(req: Request, res: Response, next: NextFunction) {
    try {
      const assets = await portfolioService.getPortfolioAssets(String(req.params.id));
      res.json(assets);
    } catch (e) { next(e); }
  }

  // Scenarios
  static async getScenarios(req: Request, res: Response, next: NextFunction) {
    try {
      const scenarios = await scenarioService.listScenarios();
      res.json(scenarios);
    } catch (e) { next(e); }
  }

  static async getScenario(req: Request, res: Response, next: NextFunction) {
    try {
      const sc = await scenarioService.getScenario(String(req.params.id));
      if (!sc) throw { status: 404, message: 'Scenario not found' };
      res.json(sc);
    } catch (e) { next(e); }
  }

  // Allocation Simulate
  static async simulateAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const { portfolio_id, sensitivity, maxWeight, maxChange } = req.body;
      if (!portfolio_id || sensitivity == null || maxWeight == null || maxChange == null) {
        throw { status: 400, message: 'Missing required parameters' };
      }
      const result = await allocationService.simulateAllocation(portfolio_id, sensitivity, maxWeight, maxChange);
      res.json({ proposed_weights: result });
    } catch (e) { next(e); }
  }

  // Stress Tests
  static async generateParameters(req: Request, res: Response, next: NextFunction) {
    try {
      const { event_id, scenario_id } = req.body;
      if (!event_id || !scenario_id) throw { status: 400, message: 'Missing event_id or scenario_id' };
      
      const params = await scenarioService.generateEventStressParameters(event_id, scenario_id);
      res.json(params);
    } catch (e) { next(e); }
  }

  static async runStressTest(req: Request, res: Response, next: NextFunction) {
    try {
      const { portfolio_id, scenario_id, event_id, parameters } = req.body;
      if (!portfolio_id || !parameters) throw { status: 400, message: 'Missing portfolio_id or parameters' };

      const result = await riskEngineService.runStressTest(portfolio_id, parameters, scenario_id, event_id);
      res.json(result);
    } catch (e) { next(e); }
  }

  static async getStressHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const history = await riskEngineService.getHistory();
      res.json(history);
    } catch (e) { next(e); }
  }

  static async getStressRun(req: Request, res: Response, next: NextFunction) {
    try {
      const run = await riskEngineService.getRun(String(req.params.id));
      if (!run) throw { status: 404, message: 'Stress test run not found' };
      res.json(run);
    } catch (e) { next(e); }
  }
}

// bust cache
