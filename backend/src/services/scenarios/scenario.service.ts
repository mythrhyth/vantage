import { prisma } from '../../db';
import { eventService } from '../events/event.service';
import { portfolioService } from '../portfolios/portfolio.service';
import { deterministicRiskEngine } from '../risk-engine/deterministic-risk-engine';
import { DEFAULT_SCENARIOS } from '../../config/portfolio-defaults';

export class ScenarioService {
  async getScenarios() {
    const existingScenarios = await prisma.scenario.findMany();
    const existingNames = new Set(existingScenarios.map(scenario => scenario.name));
    const missingDefaults = DEFAULT_SCENARIOS.filter(scenario => !existingNames.has(scenario.name));

    if (missingDefaults.length > 0) {
      await prisma.scenario.createMany({ data: [...missingDefaults] });
    }

    const scenarios = missingDefaults.length > 0 ? await prisma.scenario.findMany() : existingScenarios;
    return scenarios.map(s => ({
      id: s.id,
      name: s.name,
      rate: Number(s.rate),
      spread: Number(s.spread),
      probability: Number(s.probability),
      liquidity: Number(s.liquidity),
      inflation: Number(s.inflation)
    }));
  }

  async getScenarioById(id: string) {
    const s = await prisma.scenario.findUnique({ where: { id } });
    if (!s) return null;
    return {
      id: s.id,
      name: s.name,
      rate: Number(s.rate),
      spread: Number(s.spread),
      probability: Number(s.probability),
      liquidity: Number(s.liquidity),
      inflation: Number(s.inflation)
    };
  }

  async generateEventStressParameters(eventId: string, scenarioId?: string, portfolioId?: string) {
    const event = await eventService.getEventById(eventId);
    let scenario = null;
    if (scenarioId) {
      try {
        scenario = await this.getScenarioById(scenarioId);
      } catch {
        scenario = null;
      }
    }

    if (!event) {
      if (scenario) {
        return {
          rate: scenario.rate,
          spread: scenario.spread,
          probability: scenario.probability,
          liquidity: scenario.liquidity,
          inflation: scenario.inflation
        };
      }
      throw new Error(`Risk event not found: ${eventId}`);
    }

    let targetPortfolio = null;
    if (portfolioId) {
      targetPortfolio = await portfolioService.getPortfolioById(portfolioId);
    }
    if (!targetPortfolio) {
      const portfolios = await portfolioService.getPortfolios();
      targetPortfolio = portfolios[0];
    }

    const affected = Array.isArray(event.affectedAssets) ? event.affectedAssets : [];
    const relType = event.relevanceType || (affected.length > 0 ? 'DIRECT' : 'PORTFOLIO_WIDE');

    const rawAssets = (targetPortfolio?.assets && targetPortfolio.assets.length > 0)
      ? targetPortfolio.assets
      : (targetPortfolio?.holdings || []);

    const portInput = targetPortfolio ? {
      portfolioId: targetPortfolio.id,
      baselineValue: targetPortfolio.baselineValue || Number(targetPortfolio.baseline_value) || 1000.0,
      holdings: rawAssets.map((a: any) => ({
        assetId: a.id,
        ticker: a.ticker || undefined,
        company: a.company || undefined,
        assetClass: (a.assetType || a.asset_type || '').toUpperCase() as any,
        sector: a.sector || undefined,
        currentValue: (a.exposureValue && Number(a.exposureValue) > 0) ? Number(a.exposureValue) : ((a.exposure_value && Number(a.exposure_value) > 0) ? Number(a.exposure_value) : 0),
        currentWeight: a.currentWeight !== undefined ? Number(a.currentWeight) : (a.current_weight !== undefined ? Number(a.current_weight) : 0)
      }))
    } : {
      portfolioId: 'default',
      baselineValue: 1000.0,
      holdings: []
    };

    const detOutput = deterministicRiskEngine.calculateRisk(
      {
        id: event.id,
        title: event.title,
        category: event.category,
        classificationConfidence: event.classificationConfidence || 0.9,
        sentiment: event.sentiment,
        sentimentConfidence: event.sentimentConfidence || 0.9,
        horizon: event.horizon || 'SHORT_TERM'
      },
      portInput,
      {
        relevanceType: relType,
        relevanceScore: event.relevanceScore || 1.0,
        matchedHoldingIds: affected,
        matchedSectors: affected
      }
    );

    return detOutput.stressParameters;
  }
}

export const scenarioService = new ScenarioService();
