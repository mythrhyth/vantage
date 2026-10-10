import { Request, Response } from 'express';
import { PortfolioConfigurationError, portfolioService } from '../services/portfolios/portfolio.service';

export class PortfolioController {
  async getPortfolios(req: Request, res: Response) {
    try {
      const portfolios = await portfolioService.getPortfolios();
      res.json(portfolios);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async getPortfolioById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (typeof id !== 'string') {
        return res.status(400).json({ error: { message: 'Portfolio ID is required' } });
      }
      const portfolio = await portfolioService.getPortfolioById(id);
      if (!portfolio) {
        return res.status(404).json({ error: { message: 'Portfolio not found' } });
      }
      res.json(portfolio);
    } catch (e: any) {
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async updatePortfolio(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (typeof id !== 'string') {
        return res.status(400).json({ error: { message: 'Portfolio ID is required' } });
      }
      const body = req.body || {};
      for (const field of ['baselineValue', 'loansExposure', 'bondsExposure', 'derivativesExposure'] as const) {
        if (body[field] !== undefined && typeof body[field] !== 'number') {
          return res.status(400).json({ error: { message: `${field} must be a number` } });
        }
      }
      if (body.holdings !== undefined && !Array.isArray(body.holdings)) {
        return res.status(400).json({ error: { message: 'holdings must be an array' } });
      }
      const updated = await portfolioService.updatePortfolio(id, body);
      res.json(updated);
    } catch (e: any) {
      if (e instanceof PortfolioConfigurationError) {
        return res.status(400).json({ error: { message: e.message } });
      }
      if (e.message === 'Portfolio not found') {
        return res.status(404).json({ error: { message: 'Portfolio not found' } });
      }
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async updateHoldings(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (typeof id !== 'string') {
        return res.status(400).json({ error: { message: 'Portfolio ID is required' } });
      }
      const { holdings } = req.body;
      if (!Array.isArray(holdings)) {
        return res.status(400).json({ error: { message: 'Holdings must be an array' } });
      }
      const updated = await portfolioService.updateHoldings(id, holdings);
      res.json(updated);
    } catch (e: any) {
      if (e instanceof PortfolioConfigurationError) {
        return res.status(400).json({ error: { message: e.message } });
      }
      if (e.message === 'Portfolio not found') {
        return res.status(404).json({ error: { message: 'Portfolio not found' } });
      }
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async getPortfolioAssets(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (typeof id !== 'string') {
        return res.status(400).json({ error: { message: 'Portfolio ID is required' } });
      }
      const assets = await portfolioService.getPortfolioAssets(id);
      res.json(assets);
    } catch (e: any) {
      if (e.message === 'Portfolio not found') {
        return res.status(404).json({ error: { message: 'Portfolio not found' } });
      }
      res.status(500).json({ error: { message: e.message } });
    }
  }
}

export const portfolioController = new PortfolioController();
