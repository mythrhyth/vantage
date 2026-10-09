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
              { ticker: 'AAPL', company: 'Apple Inc.', asset_type: 'EQUITY', sector: 'Technology', current_weight: 0.15, exposure_value: 367.5, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: 'MSFT', company: 'Microsoft Corp.', asset_type: 'EQUITY', sector: 'Technology', current_weight: 0.12, exposure_value: 294.0, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: 'GOOGL', company: 'Alphabet Inc.', asset_type: 'EQUITY', sector: 'Communication Services', current_weight: 0.08, exposure_value: 196.0, sentiment: 0.0, base_sentiment: 0.0 },
              { ticker: 'JPM', company: 'JPMorgan Chase & Co.', asset_type: 'EQUITY', sector: 'Financial Services', current_weight: 0.05, exposure_value: 122.5, sentiment: 0.0, base_sentiment: 0.0 },
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

    // Create new equity assets with current weight data only
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
    let assets = await prisma.asset.findMany({
      where: { portfolio_id: portfolioId }
    });

    if (assets.length === 0) {
      const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
      if (portfolio) {
        const baseline = Number(portfolio.baseline_value) || 2450.0;
        await prisma.asset.createMany({
          data: [
            { portfolio_id: portfolioId, ticker: 'AAPL', company: 'Apple Inc.', asset_type: 'EQUITY', sector: 'Technology', current_weight: 0.15, exposure_value: 0.15 * baseline, sentiment: 0.0, base_sentiment: 0.0 },
            { portfolio_id: portfolioId, ticker: 'MSFT', company: 'Microsoft Corp.', asset_type: 'EQUITY', sector: 'Technology', current_weight: 0.12, exposure_value: 0.12 * baseline, sentiment: 0.0, base_sentiment: 0.0 },
            { portfolio_id: portfolioId, ticker: 'GOOGL', company: 'Alphabet Inc.', asset_type: 'EQUITY', sector: 'Communication Services', current_weight: 0.08, exposure_value: 0.08 * baseline, sentiment: 0.0, base_sentiment: 0.0 },
            { portfolio_id: portfolioId, ticker: 'JPM', company: 'JPMorgan Chase & Co.', asset_type: 'EQUITY', sector: 'Financial Services', current_weight: 0.05, exposure_value: 0.05 * baseline, sentiment: 0.0, base_sentiment: 0.0 },
            { portfolio_id: portfolioId, ticker: null, company: 'Corporate Loans Portfolio', asset_type: 'LOANS', sector: 'Banking & Credit', current_weight: 0.35, exposure_value: 0.35 * baseline, sentiment: 0.0, base_sentiment: 0.0 },
            { portfolio_id: portfolioId, ticker: null, company: 'Sovereign & Corporate Bonds', asset_type: 'BONDS', sector: 'Fixed Income', current_weight: 0.15, exposure_value: 0.15 * baseline, sentiment: 0.0, base_sentiment: 0.0 },
            { portfolio_id: portfolioId, ticker: null, company: 'Interest Rate Derivatives', asset_type: 'DERIVATIVES', sector: 'Hedging', current_weight: 0.10, exposure_value: 0.10 * baseline, sentiment: 0.0, base_sentiment: 0.0 }
          ]
        });
        assets = await prisma.asset.findMany({ where: { portfolio_id: portfolioId } });
      }
    }

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
      if (target === 'EQUITY') return t === 'EQUITY' || t === 'EQUITIES';
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
        derivatives: derivExp
      },
      equityExposure: equityAssets.reduce((sum: number, a: any) => sum + (a.exposure_value ? Number(a.exposure_value) : Number(a.current_weight) * baseline), 0),
      holdings: mappedHoldings,
      assets: mappedAssets,
      createdAt: p.created_at
    };
  }
}

export const portfolioService = new PortfolioService();
