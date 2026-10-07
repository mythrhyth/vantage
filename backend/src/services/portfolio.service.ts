import { prisma } from '../db';

export class PortfolioService {
  async getPortfolioAssets(portfolioId: string) {
    const assets = await prisma.asset.findMany({
      where: { portfolio_id: portfolioId }
    });
    return assets.map(a => ({
      id: a.id,
      portfolio_id: a.portfolio_id,
      ticker: a.ticker,
      company: a.company,
      asset_type: a.asset_type,
      sector: a.sector,
      current_weight: Number(a.current_weight),
      exposure_value: a.exposure_value ? Number(a.exposure_value) : null,
      sentiment: Number(a.sentiment),
      base_sentiment: Number(a.base_sentiment)
    }));
  }

  async getPortfolio(id: string) {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: { assets: true }
    });
    if (!portfolio) return null;

    const baselineValue = Number(portfolio.baseline_value);

    // Assets by type
    const loansAsset = portfolio.assets.find(a => a.asset_type === 'Loan' || a.asset_type === 'LOAN');
    const bondsAsset = portfolio.assets.find(a => a.asset_type === 'Bond' || a.asset_type === 'BOND');
    const derivativesAsset = portfolio.assets.find(a => a.asset_type === 'Derivative' || a.asset_type === 'DERIVATIVE');
    const equityAssets = portfolio.assets.filter(a => a.asset_type === 'Stock' || a.asset_type === 'EQUITY');

    const loansExposure = loansAsset?.exposure_value ? Number(loansAsset.exposure_value) : (loansAsset ? (Number(loansAsset.current_weight) / 100) * baselineValue : 0);
    const bondsExposure = bondsAsset?.exposure_value ? Number(bondsAsset.exposure_value) : (bondsAsset ? (Number(bondsAsset.current_weight) / 100) * baselineValue : 0);
    const derivativesExposure = derivativesAsset?.exposure_value ? Number(derivativesAsset.exposure_value) : (derivativesAsset ? (Number(derivativesAsset.current_weight) / 100) * baselineValue : 0);

    const totalEquityWeight = equityAssets.reduce((sum, a) => sum + Number(a.current_weight), 0);
    const equityExposure = (totalEquityWeight / 100) * baselineValue;

    return {
      id: portfolio.id,
      name: portfolio.name,
      baseline_value: baselineValue,
      index_universe: (portfolio as any).index_universe || 'NIFTY 50',
      created_at: portfolio.created_at,
      exposures: {
        loans: Number(loansExposure.toFixed(1)),
        bonds: Number(bondsExposure.toFixed(1)),
        derivatives: Number(derivativesExposure.toFixed(1)),
        equity: Number(equityExposure.toFixed(1)),
        total_equity_weight: Number(totalEquityWeight.toFixed(1))
      },
      assets: portfolio.assets.map(a => ({
        id: a.id,
        portfolio_id: a.portfolio_id,
        ticker: a.ticker,
        company: a.company,
        asset_type: a.asset_type,
        sector: a.sector,
        current_weight: Number(a.current_weight),
        exposure_value: a.exposure_value ? Number(a.exposure_value) : null,
        sentiment: Number(a.sentiment),
        base_sentiment: Number(a.base_sentiment)
      }))
    };
  }

  async listPortfolios() {
    const portfolios = await prisma.portfolio.findMany({
      include: { assets: true }
    });
    return portfolios.map(p => {
      const baselineValue = Number(p.baseline_value);
      const loansAsset = p.assets.find(a => a.asset_type === 'Loan' || a.asset_type === 'LOAN');
      const bondsAsset = p.assets.find(a => a.asset_type === 'Bond' || a.asset_type === 'BOND');
      const derivativesAsset = p.assets.find(a => a.asset_type === 'Derivative' || a.asset_type === 'DERIVATIVE');
      const equityAssets = p.assets.filter(a => a.asset_type === 'Stock' || a.asset_type === 'EQUITY');

      const loansExposure = loansAsset?.exposure_value ? Number(loansAsset.exposure_value) : (loansAsset ? (Number(loansAsset.current_weight) / 100) * baselineValue : 0);
      const bondsExposure = bondsAsset?.exposure_value ? Number(bondsAsset.exposure_value) : (bondsAsset ? (Number(bondsAsset.current_weight) / 100) * baselineValue : 0);
      const derivativesExposure = derivativesAsset?.exposure_value ? Number(derivativesAsset.exposure_value) : (derivativesAsset ? (Number(derivativesAsset.current_weight) / 100) * baselineValue : 0);
      const totalEquityWeight = equityAssets.reduce((sum, a) => sum + Number(a.current_weight), 0);
      const equityExposure = (totalEquityWeight / 100) * baselineValue;

      return {
        id: p.id,
        name: p.name,
        baseline_value: baselineValue,
        baselineValue,
        index_universe: (p as any).index_universe || 'NIFTY 50',
        created_at: p.created_at,
        exposures: {
          loans: Number(loansExposure.toFixed(1)),
          bonds: Number(bondsExposure.toFixed(1)),
          derivatives: Number(derivativesExposure.toFixed(1)),
          equity: Number(equityExposure.toFixed(1)),
          total_equity_weight: Number(totalEquityWeight.toFixed(1))
        }
      };
    });
  }

  async updatePortfolio(id: string, data: {
    name?: string;
    baselineValue?: number;
    indexUniverse?: string;
    loansExposure?: number;
    bondsExposure?: number;
    derivativesExposure?: number;
  }) {
    if (data.baselineValue !== undefined && (typeof data.baselineValue !== 'number' || data.baselineValue < 0)) {
      throw { status: 400, message: 'Invalid baseline value: must be a non-negative number' };
    }
    if (data.loansExposure !== undefined && (typeof data.loansExposure !== 'number' || data.loansExposure < 0)) {
      throw { status: 400, message: 'Invalid loans exposure: must be a non-negative number' };
    }
    if (data.bondsExposure !== undefined && (typeof data.bondsExposure !== 'number' || data.bondsExposure < 0)) {
      throw { status: 400, message: 'Invalid bonds exposure: must be a non-negative number' };
    }
    if (data.derivativesExposure !== undefined && (typeof data.derivativesExposure !== 'number' || data.derivativesExposure < 0)) {
      throw { status: 400, message: 'Invalid derivatives exposure: must be a non-negative number' };
    }

    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: { assets: true }
    });
    if (!portfolio) throw { status: 404, message: 'Portfolio not found' };

    const newBaseline = data.baselineValue !== undefined ? data.baselineValue : Number(portfolio.baseline_value);

    await prisma.portfolio.update({
      where: { id },
      data: {
        name: data.name ?? portfolio.name,
        baseline_value: newBaseline,
        index_universe: data.indexUniverse ?? (portfolio as any).index_universe
      } as any
    });

    const updateOrUpsertNonEquity = async (type: string, exposure?: number) => {
      if (exposure === undefined) return;
      const existingAsset = portfolio.assets.find(a => a.asset_type === type);
      const weight = newBaseline > 0 ? (exposure / newBaseline) * 100 : 0;
      if (existingAsset) {
        await prisma.asset.update({
          where: { id: existingAsset.id },
          data: {
            exposure_value: exposure,
            current_weight: weight
          }
        });
      } else {
        await prisma.asset.create({
          data: {
            portfolio_id: id,
            asset_type: type,
            company: type + ' Portfolio',
            current_weight: weight,
            exposure_value: exposure,
            sentiment: 0,
            base_sentiment: 0
          }
        });
      }
    };

    await updateOrUpsertNonEquity('Loan', data.loansExposure);
    await updateOrUpsertNonEquity('Bond', data.bondsExposure);
    await updateOrUpsertNonEquity('Derivative', data.derivativesExposure);

    return this.getPortfolio(id);
  }

  async updateHoldings(portfolioId: string, holdings: Array<{
    ticker: string;
    company: string;
    currentWeight: number;
    sector?: string;
  }>) {
    if (!Array.isArray(holdings)) {
      throw { status: 400, message: 'Holdings must be an array' };
    }

    // Validation 1: Check duplicate tickers
    const tickers = holdings.map(h => h.ticker.trim().toUpperCase());
    const uniqueTickers = new Set(tickers);
    if (uniqueTickers.size !== tickers.length) {
      throw { status: 400, message: 'Duplicate ticker found in equity holdings' };
    }

    // Validation 2: Check valid weights (0 <= weight <= 100) and total equity weight <= 100%
    let totalWeight = 0;
    for (const h of holdings) {
      if (typeof h.currentWeight !== 'number' || h.currentWeight < 0 || h.currentWeight > 100) {
        throw { status: 400, message: `Invalid current weight for ticker ${h.ticker}: must be between 0 and 100` };
      }
      totalWeight += h.currentWeight;
    }

    if (totalWeight > 100) {
      throw { status: 400, message: `Total equity allocation (${totalWeight.toFixed(1)}%) exceeds 100%` };
    }

    // Replace stock assets for this portfolio cleanly
    await prisma.asset.deleteMany({
      where: {
        portfolio_id: portfolioId,
        asset_type: { in: ['Stock', 'EQUITY'] }
      }
    });

    for (const h of holdings) {
      await prisma.asset.create({
        data: {
          portfolio_id: portfolioId,
          ticker: h.ticker.trim().toUpperCase(),
          company: h.company.trim(),
          asset_type: 'Stock',
          sector: h.sector || 'Technology',
          current_weight: h.currentWeight,
          sentiment: 0.25,
          base_sentiment: 0.25
        }
      });
    }

    return this.getPortfolio(portfolioId);
  }
}

export const portfolioService = new PortfolioService();
