import { prisma } from '../../db';

export class PortfolioService {
  async getPortfolios() {
    const portfolios = await prisma.portfolio.findMany({
      orderBy: { created_at: 'asc' },
      include: { assets: true }
    });
    
    if (portfolios.length === 0) {
      // Seed default portfolio if empty
      const defaultPortfolio = await prisma.portfolio.create({
        data: {
          name: 'Main Wealth Fund Portfolio',
          baseline_value: 2450.0,
          index_universe: 'NIFTY50',
          assets: {
            create: [
              { ticker: 'AAPL', company: 'Apple Inc.', asset_type: 'EQUITY', sector: 'Technology', current_weight: 0.06, exposure_value: 0.06 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: 'MSFT', company: 'Microsoft Corp.', asset_type: 'EQUITY', sector: 'Technology', current_weight: 0.055, exposure_value: 0.055 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: 'GOOGL', company: 'Alphabet Inc.', asset_type: 'EQUITY', sector: 'Communication Services', current_weight: 0.045, exposure_value: 0.045 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: 'AMZN', company: 'Amazon.com Inc.', asset_type: 'EQUITY', sector: 'Consumer Staples', current_weight: 0.04, exposure_value: 0.04 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: 'NVDA', company: 'NVIDIA Corp.', asset_type: 'EQUITY', sector: 'Technology', current_weight: 0.04, exposure_value: 0.04 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: 'JPM', company: 'JPMorgan Chase & Co.', asset_type: 'EQUITY', sector: 'Financial Services', current_weight: 0.035, exposure_value: 0.035 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: 'META', company: 'Meta Platforms Inc.', asset_type: 'EQUITY', sector: 'Communication Services', current_weight: 0.03, exposure_value: 0.03 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: 'TSLA', company: 'Tesla Inc.', asset_type: 'EQUITY', sector: 'Automotive', current_weight: 0.025, exposure_value: 0.025 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: 'RELIANCE', company: 'Reliance Industries Ltd', asset_type: 'EQUITY', sector: 'Energy', current_weight: 0.03, exposure_value: 0.03 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: 'TCS', company: 'Tata Consultancy Services', asset_type: 'EQUITY', sector: 'Technology', current_weight: 0.025, exposure_value: 0.025 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: 'HDFCBANK', company: 'HDFC Bank Ltd', asset_type: 'EQUITY', sector: 'Financial Services', current_weight: 0.025, exposure_value: 0.025 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: 'INFYS', company: 'Infosys Ltd', asset_type: 'EQUITY', sector: 'Technology', current_weight: 0.02, exposure_value: 0.02 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: null, company: 'Corporate Loans Portfolio', asset_type: 'LOANS', sector: 'Banking & Credit', current_weight: 0.30, exposure_value: 0.30 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: null, company: 'Sovereign & Corporate Bonds', asset_type: 'BONDS', sector: 'Fixed Income', current_weight: 0.17, exposure_value: 0.17 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: null, company: 'Interest Rate Derivatives', asset_type: 'DERIVATIVES', sector: 'Hedging', current_weight: 0.10, exposure_value: 0.10 * 2450.0, sentiment: 0.0, base_sentiment: 0.0 }
            ]
          }
        },
        include: { assets: true }
      });
      return [this.mapPortfolio(defaultPortfolio)];
    }

    return portfolios.map(p => this.mapPortfolio(p));
  }

  async listPortfolios() {
    return this.getPortfolios();
  }

  async getPortfolioById(id: string) {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: { assets: true }
    });

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
  }) {
    const existing = await prisma.portfolio.findUnique({
      where: { id },
      include: { assets: true }
    });

    if (!existing) throw new Error('Portfolio not found');

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.baselineValue !== undefined) updateData.baseline_value = data.baselineValue;
    if (data.indexUniverse !== undefined) updateData.index_universe = data.indexUniverse;

    await prisma.portfolio.update({
      where: { id },
      data: updateData
    });

    // Update exposure values for non-equity asset types if provided
    const baseline = data.baselineValue !== undefined ? data.baselineValue : Number(existing.baseline_value);

    if (data.loansExposure !== undefined) {
      await this.upsertNonEquityAsset(id, 'LOANS', 'Corporate Loans Portfolio', data.loansExposure, baseline);
    }
    if (data.bondsExposure !== undefined) {
      await this.upsertNonEquityAsset(id, 'BONDS', 'Sovereign & Corporate Bonds', data.bondsExposure, baseline);
    }
    if (data.derivativesExposure !== undefined) {
      await this.upsertNonEquityAsset(id, 'DERIVATIVES', 'Interest Rate Derivatives', data.derivativesExposure, baseline);
    }

    return this.getPortfolioById(id);
  }

  async updateHoldings(id: string, holdings: Array<{
    ticker: string;
    company: string;
    currentWeight: number;
    sector?: string;
  }>) {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: { assets: true }
    });

    if (!portfolio) throw new Error('Portfolio not found');

    // Validation
    const tickers = holdings.map(h => h.ticker.trim().toUpperCase());
    const uniqueTickers = new Set(tickers);
    if (uniqueTickers.size !== tickers.length) {
      throw new Error('Duplicate stock ticker detected in equity holdings');
    }

    for (const h of holdings) {
      if (h.currentWeight < 0) {
        throw new Error(`Holding weight for ${h.ticker} cannot be negative`);
      }
    }

    const totalWeight = holdings.reduce((sum, h) => sum + (Number(h.currentWeight) || 0), 0);
    const maxWeightAllowed = totalWeight > 1.0 ? 100.0 : 1.0;
    if (totalWeight > maxWeightAllowed) {
      throw new Error(`Total equity holdings weight (${totalWeight.toFixed(1)}%) cannot exceed 100%`);
    }

    const baseline = Number(portfolio.baseline_value);

    // Remove existing equity assets
    await prisma.asset.deleteMany({
      where: {
        portfolio_id: id,
        asset_type: {
          in: ['EQUITY', 'Stock', 'STOCK', 'equities', 'EQUITIES', 'stock', 'stocks', 'STOCKS']
        }
      }
    });

    // Create new equity assets with decimal current weight
    if (holdings.length > 0) {
      await prisma.asset.createMany({
        data: holdings.map(h => {
          const weightDecimal = h.currentWeight > 1.0 ? h.currentWeight / 100 : h.currentWeight;
          return {
            portfolio_id: id,
            ticker: h.ticker.toUpperCase(),
            company: h.company,
            asset_type: 'EQUITY',
            sector: h.sector || 'General',
            current_weight: weightDecimal,
            exposure_value: weightDecimal * baseline,
            sentiment: 0.0,
            base_sentiment: 0.0
          };
        })
      });
    }

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
    const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const assets = await prisma.asset.findMany({
      where: { portfolio_id: portfolioId }
    });

    return Promise.all(assets.map(async a => {
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

  private async upsertNonEquityAsset(portfolioId: string, assetType: string, companyName: string, exposureValue: number, baseline: number) {
    const existing = await prisma.asset.findFirst({
      where: { portfolio_id: portfolioId, asset_type: assetType }
    });

    const weight = baseline > 0 ? exposureValue / baseline : 0;

    if (existing) {
      await prisma.asset.update({
        where: { id: existing.id },
        data: {
          exposure_value: exposureValue,
          current_weight: weight
        }
      });
    } else {
      await prisma.asset.create({
        data: {
          portfolio_id: portfolioId,
          company: companyName,
          asset_type: assetType,
          current_weight: weight,
          exposure_value: exposureValue,
          sentiment: 0.0,
          base_sentiment: 0.0
        }
      });
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

    const loansAsset = assets.find((a: any) => isAssetType(a.asset_type, 'LOANS'));
    const bondsAsset = assets.find((a: any) => isAssetType(a.asset_type, 'BONDS'));
    const derivativesAsset = assets.find((a: any) => isAssetType(a.asset_type, 'DERIVATIVES'));
    const equityAssets = assets.filter((a: any) => isAssetType(a.asset_type, 'EQUITY'));

    const baseline = Number(p.baseline_value);

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
        exposureValue: a.exposure_value ? Number(a.exposure_value) : Number(a.current_weight) * baseline,
        exposure_value: a.exposure_value ? Number(a.exposure_value) : Number(a.current_weight) * baseline,
        sentiment: Number(a.sentiment)
      };
    });

    const mappedHoldings = mappedAssets.filter((a: any) => isAssetType(a.asset_type, 'EQUITY'));
    const loansExp = loansAsset?.exposure_value ? Number(loansAsset.exposure_value) : (loansAsset?.current_weight ? Number(loansAsset.current_weight) * baseline : 0);
    const bondsExp = bondsAsset?.exposure_value ? Number(bondsAsset.exposure_value) : (bondsAsset?.current_weight ? Number(bondsAsset.current_weight) * baseline : 0);
    const derivExp = derivativesAsset?.exposure_value ? Number(derivativesAsset.exposure_value) : (derivativesAsset?.current_weight ? Number(derivativesAsset.current_weight) * baseline : 0);

    const equityExp = equityAssets.reduce((sum: number, a: any) => {
      const weightDecimal = Number(a.current_weight) > 1.0 ? Number(a.current_weight) / 100 : Number(a.current_weight);
      return sum + (a.exposure_value ? Number(a.exposure_value) : weightDecimal * baseline);
    }, 0);
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
