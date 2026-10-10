import { prisma } from '../../db';
import { DEFAULT_PORTFOLIO_ASSETS, DEFAULT_PORTFOLIO_BASELINE } from '../../config/portfolio-defaults';

export class PortfolioConfigurationError extends Error {}

type EquityHoldingInput = {
  ticker: string;
  company: string;
  currentWeight: number;
  sector?: string;
};

export class PortfolioService {
  async getPortfolios() {
    const storedPortfolios = await prisma.portfolio.findMany({
      orderBy: { created_at: 'asc' },
      include: { assets: true }
    });
    
    if (storedPortfolios.length === 0) {
      const defaultPortfolio = await prisma.portfolio.create({
        data: {
          name: 'Main Wealth Fund Portfolio',
          baseline_value: DEFAULT_PORTFOLIO_BASELINE,
          index_universe: 'NIFTY50',
          assets: {
            create: DEFAULT_PORTFOLIO_ASSETS.map(asset => ({
              ...asset,
              exposure_value: asset.current_weight * DEFAULT_PORTFOLIO_BASELINE,
              sentiment: 0,
              base_sentiment: 0
            }))
          }
        },
        include: { assets: true }
      });
      return [this.mapPortfolio(defaultPortfolio)];
    }

    const portfolios = await Promise.all(
      storedPortfolios.map(portfolio => this.reconcilePortfolio(portfolio.id))
    );
    return portfolios.map(p => this.mapPortfolio(p));
  }

  async listPortfolios() {
    return this.getPortfolios();
  }

  async getPortfolioById(id: string) {
    const portfolio = await this.reconcilePortfolio(id);

    if (!portfolio) return null;
    return this.mapPortfolio(portfolio);
  }

  async getPortfolio(id: string) {
    return this.getPortfolioById(id);
  }

  async updatePortfolio(id: string, data: {
    name?: string;
    baselineValue?: number;
    indexUniverse?: string;
    loansExposure?: number;
    bondsExposure?: number;
    derivativesExposure?: number;
    holdings?: EquityHoldingInput[];
  }) {
    const existing = await prisma.portfolio.findUnique({
      where: { id },
      include: { assets: true }
    });

    if (!existing) throw new Error('Portfolio not found');

    const baseline = data.baselineValue ?? Number(existing.baseline_value);
    if (!Number.isFinite(baseline) || baseline <= 0) {
      throw new PortfolioConfigurationError('Portfolio baseline must be a positive number.');
    }

    const equityAssets = existing.assets.filter(asset => this.isEquityAsset(asset.asset_type));
    const holdings = data.holdings ?? equityAssets.map(asset => ({
      ticker: asset.ticker || '',
      company: asset.company || asset.ticker || '',
      sector: asset.sector || 'General',
      currentWeight: this.toWeightPercent(Number(asset.current_weight))
    }));
    this.validateEquityHoldings(holdings);

    const exposureConfig = [
      { type: 'LOANS', name: 'Corporate Loans Portfolio', input: data.loansExposure, label: 'loans' },
      { type: 'BONDS', name: 'Sovereign & Corporate Bonds', input: data.bondsExposure, label: 'bonds' },
      { type: 'DERIVATIVES', name: 'Interest Rate Derivatives', input: data.derivativesExposure, label: 'derivatives' }
    ].map(item => {
      const current = existing.assets.find(asset => asset.asset_type.toUpperCase() === item.type);
      const amount = item.input ?? (current
        ? Number(current.exposure_value ?? this.toWeightDecimal(Number(current.current_weight)) * Number(existing.baseline_value))
        : 0);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new PortfolioConfigurationError(`${item.label} exposure must be a non-negative number.`);
      }
      return { ...item, amount, current };
    });

    const totalEquityExposure = holdings.reduce(
      (sum, holding) => sum + (holding.currentWeight / 100) * baseline,
      0
    );
    const totalExposure = exposureConfig.reduce((sum, item) => sum + item.amount, totalEquityExposure);
    this.validatePortfolioBalance(totalExposure, baseline);

    await prisma.$transaction(async transaction => {
      await transaction.portfolio.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          baseline_value: baseline,
          ...(data.indexUniverse !== undefined ? { index_universe: data.indexUniverse } : {})
        }
      });

      await transaction.asset.deleteMany({
        where: { portfolio_id: id, asset_type: { in: ['EQUITY', 'Stock', 'STOCK', 'equities', 'EQUITIES', 'stock', 'stocks', 'STOCKS'] } }
      });
      if (holdings.length > 0) {
        await transaction.asset.createMany({
          data: holdings.map(holding => ({
            portfolio_id: id,
            ticker: holding.ticker.trim().toUpperCase(),
            company: holding.company.trim(),
            asset_type: 'EQUITY',
            sector: holding.sector || 'General',
            current_weight: holding.currentWeight / 100,
            exposure_value: (holding.currentWeight / 100) * baseline,
            sentiment: 0,
            base_sentiment: 0
          }))
        });
      }

      for (const item of exposureConfig) {
        const assetData = {
          current_weight: item.amount / baseline,
          exposure_value: item.amount
        };
        if (item.current) {
          await transaction.asset.update({ where: { id: item.current.id }, data: assetData });
        } else {
          await transaction.asset.create({
            data: {
              portfolio_id: id,
              company: item.name,
              asset_type: item.type,
              sector: item.type === 'LOANS' ? 'Banking & Credit' : item.type === 'BONDS' ? 'Fixed Income' : 'Hedging',
              ...assetData,
              sentiment: 0,
              base_sentiment: 0
            }
          });
        }
      }
    });

    return this.getPortfolioById(id);
  }

  async updateHoldings(id: string, holdings: EquityHoldingInput[]) {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: { assets: true }
    });

    if (!portfolio) throw new Error('Portfolio not found');

    this.validateEquityHoldings(holdings);
    const baseline = Number(portfolio.baseline_value);
    const equityExposure = holdings.reduce((sum, holding) => sum + (holding.currentWeight / 100) * baseline, 0);
    const nonEquityExposure = portfolio.assets
      .filter(asset => !this.isEquityAsset(asset.asset_type))
      .reduce((sum, asset) => sum + Number(asset.exposure_value ?? this.toWeightDecimal(Number(asset.current_weight)) * baseline), 0);
    this.validatePortfolioBalance(equityExposure + nonEquityExposure, baseline);

    await prisma.$transaction(async transaction => {
      await transaction.asset.deleteMany({
        where: {
          portfolio_id: id,
          asset_type: {
            in: ['EQUITY', 'Stock', 'STOCK', 'equities', 'EQUITIES', 'stock', 'stocks', 'STOCKS']
          }
        }
      });

      if (holdings.length > 0) {
        await transaction.asset.createMany({
          data: holdings.map(holding => ({
            portfolio_id: id,
            ticker: holding.ticker.trim().toUpperCase(),
            company: holding.company.trim(),
            asset_type: 'EQUITY',
            sector: holding.sector || 'General',
            current_weight: holding.currentWeight / 100,
            exposure_value: (holding.currentWeight / 100) * baseline,
            sentiment: 0,
            base_sentiment: 0
          }))
        })
      }
    });

    return this.getPortfolioById(id);
  }

  async getAssetNlpSentiment(ticker?: string | null, company?: string | null, sector?: string | null): Promise<number> {
    const events = await prisma.riskEvent.findMany({
      take: 50,
      orderBy: { created_at: 'desc' }
    });

    const matches: Array<{ sentiment: number; impact: number }> = [];

    for (const e of events) {
      const affected = Array.isArray(e.affected_assets) ? e.affected_assets.map(a => String(a).toLowerCase()) : [];
      const entity = (e.entity || '').toLowerCase();
      const title = (e.title || '').toLowerCase();
      const cat = (e.category || '').toLowerCase();

      const tLower = (ticker || '').toLowerCase();
      const cLower = (company || '').toLowerCase();
      const sLower = (sector || '').toLowerCase();

      const matched = (tLower && (affected.includes(tLower) || entity.includes(tLower) || title.includes(tLower))) ||
                      (cLower && (affected.includes(cLower) || entity.includes(cLower) || title.includes(cLower))) ||
                      (sLower && cat.includes(sLower));

      if (matched) {
        matches.push({ sentiment: Number(e.sentiment), impact: Number(e.impact) });
      }
    }

    if (matches.length === 0) return 0.0;

    const totalWeight = matches.reduce((acc, m) => acc + Math.max(0.1, m.impact), 0);
    const weightedSum = matches.reduce((acc, m) => acc + m.sentiment * Math.max(0.1, m.impact), 0);

    return parseFloat((weightedSum / totalWeight).toFixed(2));
  }

  async getPortfolioAssets(portfolioId: string) {
    const portfolio = await this.reconcilePortfolio(portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    return Promise.all(portfolio.assets.map(async a => {
      const nlpSentiment = await this.getAssetNlpSentiment(a.ticker, a.company, a.sector);
      const rawWeight = Number(a.current_weight);
      const currentPct = rawWeight <= 1.0 ? rawWeight * 100 : rawWeight;
      return {
        id: a.id,
        ticker: a.ticker,
        company: a.company,
        assetType: a.asset_type,
        asset_type: a.asset_type,
        sector: a.sector,
        currentWeight: parseFloat(currentPct.toFixed(2)),
        current_weight: parseFloat(currentPct.toFixed(2)),
        exposureValue: a.exposure_value ? Number(a.exposure_value) : null,
        exposure_value: a.exposure_value ? Number(a.exposure_value) : null,
        sentiment: nlpSentiment !== 0 ? nlpSentiment : Number(a.sentiment),
        baseSentiment: Number(a.base_sentiment)
      };
    }));
  }

  private isEquityAsset(assetType: string): boolean {
    return ['EQUITY', 'EQUITIES', 'STOCK', 'STOCKS'].includes(assetType.toUpperCase());
  }

  private async reconcilePortfolio(id: string) {
    return prisma.$transaction(async transaction => {
      const portfolio = await transaction.portfolio.findUnique({
        where: { id },
        include: { assets: true }
      });
      if (!portfolio || portfolio.assets.length === 0) {
        return portfolio;
      }

      const baseline = Number(portfolio.baseline_value);
      if (!Number.isFinite(baseline) || baseline <= 0) {
        return portfolio;
      }

      const assetExposures = portfolio.assets.map(asset => {
        const weight = this.toWeightDecimal(Number(asset.current_weight));
        const exposure = asset.exposure_value === null
          ? weight * baseline
          : Number(asset.exposure_value);
        return { asset, exposure };
      });
      const totalExposure = assetExposures.reduce((total, item) => total + item.exposure, 0);

      if (!Number.isFinite(totalExposure) || totalExposure <= 0 || Math.abs(totalExposure - baseline) <= 1) {
        return portfolio;
      }

      for (const { asset, exposure } of assetExposures) {
        const weight = exposure / totalExposure;
        await transaction.asset.update({
          where: { id: asset.id },
          data: {
            current_weight: weight,
            exposure_value: weight * baseline
          }
        });
      }

      return transaction.portfolio.findUnique({
        where: { id },
        include: { assets: true }
      });
    });
  }

  private toWeightPercent(weight: number): number {
    return weight <= 1 ? weight * 100 : weight;
  }

  private toWeightDecimal(weight: number): number {
    return weight > 1 ? weight / 100 : weight;
  }

  private validateEquityHoldings(holdings: EquityHoldingInput[]): void {
    if (!Array.isArray(holdings) || holdings.some(holding =>
      !holding || typeof holding.ticker !== 'string' || typeof holding.company !== 'string'
    )) {
      throw new PortfolioConfigurationError('Each equity holding must include a ticker and company name.');
    }
    const tickers = holdings.map(holding => holding.ticker.trim().toUpperCase());
    if (tickers.some(ticker => !ticker)) {
      throw new PortfolioConfigurationError('Every equity holding must have a ticker.');
    }
    if (holdings.some(holding => !holding.company.trim())) {
      throw new PortfolioConfigurationError('Every equity holding must have a company name.');
    }
    if (new Set(tickers).size !== tickers.length) {
      throw new PortfolioConfigurationError('Duplicate stock ticker detected in equity holdings.');
    }

    for (const holding of holdings) {
      if (!Number.isFinite(holding.currentWeight) || holding.currentWeight < 0 || holding.currentWeight > 100) {
        throw new PortfolioConfigurationError(`Holding weight for ${holding.ticker} must be between 0% and 100%.`);
      }
    }

    const totalWeight = holdings.reduce((sum, holding) => sum + holding.currentWeight, 0);
    if (totalWeight > 100.0001) {
      throw new PortfolioConfigurationError(`Total equity holdings weight (${totalWeight.toFixed(2)}%) cannot exceed 100%.`);
    }
  }

  private validatePortfolioBalance(totalExposure: number, baseline: number): void {
    if (Math.abs(totalExposure - baseline) > 1) {
      throw new PortfolioConfigurationError(
        `Asset exposures total ₹${totalExposure.toFixed(1)} Cr but the configured baseline is ₹${baseline.toFixed(1)} Cr. Adjust holdings and asset-class exposures so they reconcile within ₹1 Cr.`
      );
    }
  }

  private mapPortfolio(p: any) {
    const assets = p.assets || [];
    const isAssetType = (assetType: string, target: string) => {
      const t = (assetType || '').toUpperCase();
      if (target === 'LOANS') return t === 'LOANS' || t === 'LOAN';
      if (target === 'BONDS') return t === 'BONDS' || t === 'BOND';
      if (target === 'DERIVATIVES') return t === 'DERIVATIVES' || t === 'DERIVATIVE';
      if (target === 'EQUITY') return t === 'EQUITY' || t === 'EQUITIES' || t === 'STOCK' || t === 'STOCKS';
      return t === target;
    };

    const loansAssets = assets.filter((a: any) => isAssetType(a.asset_type, 'LOANS'));
    const bondsAssets = assets.filter((a: any) => isAssetType(a.asset_type, 'BONDS'));
    const derivativesAssets = assets.filter((a: any) => isAssetType(a.asset_type, 'DERIVATIVES'));
    const equityAssets = assets.filter((a: any) => isAssetType(a.asset_type, 'EQUITY'));

    const baseline = Number(p.baseline_value);
    const exposureOf = (asset: any) => asset.exposure_value === null
      ? this.toWeightDecimal(Number(asset.current_weight)) * baseline
      : Number(asset.exposure_value);
    const sumExposure = (assetRows: any[]) => assetRows.reduce((total, asset) => total + exposureOf(asset), 0);

    const mappedAssets = assets.map((a: any) => {
      const rawWeight = Number(a.current_weight);
      const currentPct = rawWeight <= 1.0 ? rawWeight * 100 : rawWeight;
      return {
        id: a.id,
        ticker: a.ticker,
        company: a.company,
        assetType: a.asset_type,
        asset_type: a.asset_type,
        sector: a.sector,
        currentWeight: parseFloat(currentPct.toFixed(2)),
        current_weight: parseFloat(currentPct.toFixed(2)),
        exposureValue: exposureOf(a),
        exposure_value: exposureOf(a),
        sentiment: Number(a.sentiment)
      };
    });

    const mappedHoldings = mappedAssets.filter((a: any) => isAssetType(a.asset_type, 'EQUITY'));
    const loansExp = sumExposure(loansAssets);
    const bondsExp = sumExposure(bondsAssets);
    const derivExp = sumExposure(derivativesAssets);
    const equityExp = sumExposure(equityAssets);
    const totalEquityWeight = equityAssets.reduce((sum: number, a: any) => {
      const w = Number(a.current_weight);
      return sum + (w <= 1.0 ? w * 100 : w);
    }, 0);

    return {
      id: p.id,
      name: p.name,
      baselineValue: baseline,
      baseline_value: baseline,
      indexUniverse: p.index_universe || 'NIFTY50',
      index_universe: p.index_universe || 'NIFTY50',
      loansExposure: loansExp,
      bondsExposure: bondsExp,
      derivativesExposure: derivExp,
      exposures: {
        loans: loansExp,
        bonds: bondsExp,
        derivatives: derivExp,
        equity: equityExp,
        total_equity_weight: parseFloat(totalEquityWeight.toFixed(2))
      },
      equityExposure: equityExp,
      holdings: mappedHoldings,
      assets: mappedAssets,
      createdAt: p.created_at
    };
  }
}

export const portfolioService = new PortfolioService();
