import { Request, Response } from 'express';
import { portfolioService } from '../services/portfolios/portfolio.service';

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
      const portfolio = await portfolioService.getPortfolioById(req.params.id);
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
      const updated = await portfolioService.updatePortfolio(req.params.id, req.body);
      res.json(updated);
    } catch (e: any) {
      if (e.message === 'Portfolio not found') {
        return res.status(404).json({ error: { message: 'Portfolio not found' } });
      }
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async updateHoldings(req: Request, res: Response) {
    try {
      const { holdings } = req.body;
      if (!Array.isArray(holdings)) {
        return res.status(400).json({ error: { message: 'Holdings must be an array' } });
      }
      const updated = await portfolioService.updateHoldings(req.params.id, holdings);
      res.json(updated);
    } catch (e: any) {
      if (e.message === 'Portfolio not found') {
        return res.status(404).json({ error: { message: 'Portfolio not found' } });
      }
      res.status(500).json({ error: { message: e.message } });
    }
  }

  async getPortfolioAssets(req: Request, res: Response) {
    try {
      const assets = await portfolioService.getPortfolioAssets(req.params.id);
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
