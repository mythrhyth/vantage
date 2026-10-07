import { Router } from 'express';
import { portfolioController } from '../controllers/portfolio.controller';

const router = Router();

router.get('/portfolios', (req, res) => portfolioController.getPortfolios(req, res));
router.get('/portfolios/:id', (req, res) => portfolioController.getPortfolioById(req, res));
router.put('/portfolios/:id', (req, res) => portfolioController.updatePortfolio(req, res));
router.put('/portfolios/:id/holdings', (req, res) => portfolioController.updateHoldings(req, res));
router.get('/portfolio/:id/assets', (req, res) => portfolioController.getPortfolioAssets(req, res));

export default router;
