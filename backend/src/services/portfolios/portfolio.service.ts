import { prisma } from '../../db';

export class PortfolioService {
  async getPortfolios() {
    const portfolios = await prisma.portfolio.findMany({
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
              { ticker: 'AAPL', company: 'Apple Inc.', asset_type: 'EQUITY', sector: 'Technology', current_weight: 0.15, exposure_value: 367.5, sentiment: 0.12, base_sentiment: 0.15 },
              { ticker: 'MSFT', company: 'Microsoft Corp.', asset_type: 'EQUITY', sector: 'Technology', current_weight: 0.12, exposure_value: 294.0, sentiment: 0.08, base_sentiment: 0.10 },
              { ticker: 'GOOGL', company: 'Alphabet Inc.', asset_type: 'EQUITY', sector: 'Communication Services', current_weight: 0.08, exposure_value: 196.0, sentiment: -0.05, base_sentiment: 0.02 },
              { ticker: 'JPM', company: 'JPMorgan Chase & Co.', asset_type: 'EQUITY', sector: 'Financial Services', current_weight: 0.05, exposure_value: 122.5, sentiment: 0.18, base_sentiment: 0.20 },
              { ticker: null, company: 'Corporate Loans Portfolio', asset_type: 'LOANS', sector: 'Banking & Credit', current_weight: 0.35, exposure_value: 857.5, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: null, company: 'Sovereign & Corporate Bonds', asset_type: 'BONDS', sector: 'Fixed Income', current_weight: 0.15, exposure_value: 367.5, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: null, company: 'Interest Rate Derivatives', asset_type: 'DERIVATIVES', sector: 'Hedging', current_weight: 0.10, exposure_value: 245.0, sentiment: 0.0, base_sentiment: 0.0 }
            ]
          }
        },
        include: { assets: true }
      });
      return [this.mapPortfolio(defaultPortfolio)];
    }

    return portfolios.map(p => this.mapPortfolio(p));
  }

  async getPortfolioById(id: string) {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: { assets: true }
    });

    if (!portfolio) return null;
    return this.mapPortfolio(portfolio);
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

    const baseline = Number(portfolio.baseline_value);

    // Remove existing equity assets
    await prisma.asset.deleteMany({
      where: {
        portfolio_id: id,
        asset_type: 'EQUITY'
      }
    });

    // Create new equity assets
    if (holdings.length > 0) {
      await prisma.asset.createMany({
        data: holdings.map(h => ({
          portfolio_id: id,
          ticker: h.ticker.toUpperCase(),
          company: h.company,
          asset_type: 'EQUITY',
          sector: h.sector || 'General',
          current_weight: h.currentWeight,
          exposure_value: h.currentWeight * baseline,
          sentiment: 0.0,
          base_sentiment: 0.0
        }))
      });
    }

    return this.getPortfolioById(id);
  }

  async getPortfolioAssets(portfolioId: string) {
    const assets = await prisma.asset.findMany({
      where: { portfolio_id: portfolioId }
    });
    return assets.map(a => ({
      id: a.id,
      ticker: a.ticker,
      company: a.company,
      assetType: a.asset_type,
      sector: a.sector,
      currentWeight: Number(a.current_weight),
      exposureValue: a.exposure_value ? Number(a.exposure_value) : null,
      sentiment: Number(a.sentiment),
      baseSentiment: Number(a.base_sentiment)
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
    const loansAsset = assets.find((a: any) => a.asset_type === 'LOANS');
    const bondsAsset = assets.find((a: any) => a.asset_type === 'BONDS');
    const derivativesAsset = assets.find((a: any) => a.asset_type === 'DERIVATIVES');
    const equityAssets = assets.filter((a: any) => a.asset_type === 'EQUITY');

    const baseline = Number(p.baseline_value);

    return {
      id: p.id,
      name: p.name,
      baselineValue: baseline,
      indexUniverse: p.index_universe || 'NIFTY50',
      loansExposure: loansAsset?.exposure_value ? Number(loansAsset.exposure_value) : (loansAsset?.current_weight ? Number(loansAsset.current_weight) * baseline : 0),
      bondsExposure: bondsAsset?.exposure_value ? Number(bondsAsset.exposure_value) : (bondsAsset?.current_weight ? Number(bondsAsset.current_weight) * baseline : 0),
      derivativesExposure: derivativesAsset?.exposure_value ? Number(derivativesAsset.exposure_value) : (derivativesAsset?.current_weight ? Number(derivativesAsset.current_weight) * baseline : 0),
      equityExposure: equityAssets.reduce((sum: number, a: any) => sum + (a.exposure_value ? Number(a.exposure_value) : Number(a.current_weight) * baseline), 0),
      holdings: equityAssets.map((a: any) => ({
        id: a.id,
        ticker: a.ticker,
        company: a.company,
        sector: a.sector,
        currentWeight: Number(a.current_weight),
        exposureValue: a.exposure_value ? Number(a.exposure_value) : Number(a.current_weight) * baseline,
        sentiment: Number(a.sentiment)
      })),
      createdAt: p.created_at
    };
  }
}

export const portfolioService = new PortfolioService();
