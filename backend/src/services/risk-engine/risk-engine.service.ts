import { prisma } from '../../db';
import { portfolioService } from '../portfolios/portfolio.service';
import { scenarioService } from '../scenarios/scenario.service';
import { eventService } from '../events/event.service';

export function hasExplicitShockParameters(parameters?: Record<string, any>): boolean {
  if (!parameters || typeof parameters !== 'object') return false;

  const isNonDefault = (val: any, defaultVal: number) => {
    if (val === undefined || val === null) return false;
    const num = Number(val);
    return !isNaN(num) && num !== defaultVal;
  };

  // Market & rate sliders (baseline 100)
  if (isNonDefault(parameters.sp, 100)) return true;
  if (isNonDefault(parameters.emerging, 100)) return true;
  if (isNonDefault(parameters.technology, 100)) return true;
  if (isNonDefault(parameters.oil, 100)) return true;
  if (isNonDefault(parameters.gold, 100)) return true;
  if (isNonDefault(parameters.dollar, 100)) return true;
  if (isNonDefault(parameters.rates, 100)) return true;

  // Rate, spread, liquidity in bps / percentage (baseline 0)
  if (isNonDefault(parameters.rate, 0)) return true;
  if (isNonDefault(parameters.spread, 0)) return true;
  if (isNonDefault(parameters.liquidity, 0)) return true;

  // Inflation (baseline 100 if rates present, 0 otherwise)
  if (parameters.rates !== undefined) {
    if (isNonDefault(parameters.inflation, 100)) return true;
  } else {
    if (isNonDefault(parameters.inflation, 0)) return true;
  }

  return false;
}

export class RiskEngineService {
  async runStressTest(portfolioId: string, parameters: {
    rate?: number; rates?: number;
    spread?: number;
    liquidity?: number;
    inflation?: number;
    probability?: number;
    sp?: number;
    emerging?: number;
    technology?: number;
    oil?: number;
    gold?: number;
    dollar?: number;
    horizon?: string;
  } = {}, scenarioId?: string, eventId?: string) {
    const portfolio = await portfolioService.getPortfolioById(portfolioId);
    if (!portfolio) throw new Error('Portfolio not found');

    let resolvedParameters: Record<string, any> = { ...parameters };
    let parameterSource: 'manual' | 'event_derived' | 'default' = 'default';

    const hasExplicit = hasExplicitShockParameters(parameters);

    if (eventId) {
      // Validate event existence - missing/invalid event throws clear error rather than falling back
      const event = await eventService.getEventById(eventId);
      if (!event) {
        throw new Error(`Risk event not found: ${eventId}`);
      }

      if (hasExplicit) {
        parameterSource = 'manual';
        resolvedParameters = { ...parameters, parameter_source: 'manual' };
      } else {
        // Derive parameters from event & portfolio via deterministic engine
        const eventDerived = await scenarioService.generateEventStressParameters(eventId, scenarioId, portfolioId);
        parameterSource = 'event_derived';
        resolvedParameters = {
          ...eventDerived,
          horizon: parameters?.horizon,
          parameter_source: 'event_derived'
        };
      }
    } else {
      if (hasExplicit) {
        parameterSource = 'manual';
        resolvedParameters = { ...parameters, parameter_source: 'manual' };
      } else {
        parameterSource = 'default';
        resolvedParameters = { ...parameters, parameter_source: 'default' };
      }
    }

    const baselineValue = portfolio.baselineValue;

    // Parse market variables (baseline 100 in PortfolioStressTesting)
    const spShift = resolvedParameters.sp !== undefined ? (resolvedParameters.sp - 100) / 100 : 0;
    const emergingShift = resolvedParameters.emerging !== undefined ? (resolvedParameters.emerging - 100) / 100 : 0;
    const techShift = resolvedParameters.technology !== undefined ? (resolvedParameters.technology - 100) / 100 : 0;
    const oilShift = resolvedParameters.oil !== undefined ? (resolvedParameters.oil - 100) / 100 : 0;
    const goldShift = resolvedParameters.gold !== undefined ? (resolvedParameters.gold - 100) / 100 : 0;
    const dollarShift = resolvedParameters.dollar !== undefined ? (resolvedParameters.dollar - 100) / 100 : 0;

    // Parse rate shift:
    // `rates` is passed from PortfolioStressTesting sliders (baseline 100, e.g. 110 = +0.10)
    // `rate` is passed from Scenario Analysis sliders / presets / event parameters in basis points (e.g. 250 bps = +0.025)
    let rateShift = 0;
    if (resolvedParameters.rates !== undefined) {
      rateShift = (resolvedParameters.rates - 100) / 100;
    } else if (resolvedParameters.rate !== undefined) {
      rateShift = resolvedParameters.rate / 10000;
    }

    // Parse spread shift: passed in basis points (e.g. 120 bps = +0.012)
    const spreadShift = (resolvedParameters.spread || 0) / 10000;

    // Parse liquidity haircut: passed in percentage points (e.g. 8% = 0.08)
    const liquidityHaircut = (resolvedParameters.liquidity || 0) / 100;

    // Parse inflation shift:
    // When `rates` is present, `inflation` is passed from PortfolioStressTesting sliders (baseline 100, e.g. 110 = +0.10)
    // Otherwise `inflation` is passed from Scenario Analysis sliders / presets in basis points (e.g. 150 bps = +0.015)
    let inflationShift = 0;
    if (resolvedParameters.rates !== undefined && resolvedParameters.inflation !== undefined) {
      inflationShift = (resolvedParameters.inflation - 100) / 100;
    } else if (resolvedParameters.inflation !== undefined) {
      inflationShift = resolvedParameters.inflation / 10000;
    }

    // Parse horizon parameter (3 months, 6 months, 12 months, 24 months)
    let horizonMultiplier = 1.0;
    if (resolvedParameters.horizon) {
      const hStr = String(resolvedParameters.horizon).toLowerCase();
      let years = 1.0;
      if (hStr.includes('3')) years = 0.25;
      else if (hStr.includes('6')) years = 0.5;
      else if (hStr.includes('24') || hStr.includes('2 year')) years = 2.0;
      else years = 1.0;

      // Square-root of time scaling factor for cumulative risk accumulation over time horizon T
      horizonMultiplier = Math.sqrt(years);
    }

    // Parse default probability shift (% points, e.g. 2% = 0.02)
    const pdShift = (resolvedParameters.probability || 0) / 100;

    // Asset class sensitivities incorporating market, macro & credit shocks
    const marketStress = Math.max(0, -spShift * 0.3) + Math.max(0, -techShift * 0.2) + Math.max(0, -emergingShift * 0.2);
    const commodityFxStress = Math.abs(oilShift * 0.15) + Math.abs(dollarShift * 0.1) + Math.abs(goldShift * 0.05);

    const rawLoansLoss = portfolio.loansExposure * (spreadShift * 0.4 + Math.max(0, rateShift) * 0.1 + pdShift * 0.4 + marketStress * 0.2) * horizonMultiplier;
    // Fixed Income (Bonds): Rate increases (rateShift > 0) produce price loss; rate cuts (rateShift < 0) yield capital gains / loss reduction
    const rawBondsLoss = portfolio.bondsExposure * (rateShift * 0.5 + spreadShift * 0.2 + Math.max(0, inflationShift) * 0.2 + commodityFxStress * 0.1) * horizonMultiplier;
    const rawDerivativesLoss = portfolio.derivativesExposure * (liquidityHaircut * 0.6 + Math.abs(rateShift) * 0.2 + commodityFxStress * 0.2) * horizonMultiplier;
    const rawEquityLoss = portfolio.equityExposure * (marketStress * 0.5 + Math.max(0, rateShift) * 0.2 + Math.max(0, inflationShift) * 0.2 + liquidityHaircut * 0.1) * horizonMultiplier;

    const rawTotal = rawLoansLoss + rawBondsLoss + rawDerivativesLoss + rawEquityLoss;
    const absoluteLoss = Math.max(0, rawTotal);
    const stressedValue = Math.max(0, baselineValue - absoluteLoss);
    const riskScore = Math.min(100, Math.max(0, Math.round((absoluteLoss / (baselineValue || 1)) * 100)));

    // Exact mathematical factor decomposition matching asset class sensitivity equations
    const rateFactorLoss = (portfolio.loansExposure * 0.1 * Math.max(0, rateShift) + portfolio.bondsExposure * 0.5 * rateShift + portfolio.derivativesExposure * 0.2 * Math.abs(rateShift) + portfolio.equityExposure * 0.2 * Math.max(0, rateShift)) * horizonMultiplier;
    const spreadFactorLoss = (portfolio.loansExposure * 0.4 * spreadShift + portfolio.bondsExposure * 0.2 * spreadShift) * horizonMultiplier;
    const pdFactorLoss = (portfolio.loansExposure * 0.4 * pdShift) * horizonMultiplier;
    const liquidityFactorLoss = (portfolio.derivativesExposure * 0.6 * liquidityHaircut + portfolio.equityExposure * 0.1 * liquidityHaircut) * horizonMultiplier;
    const inflationFactorLoss = (portfolio.bondsExposure * 0.2 * Math.max(0, inflationShift) + portfolio.equityExposure * 0.2 * Math.max(0, inflationShift)) * horizonMultiplier;
    const marketEquityFactorLoss = (portfolio.loansExposure * 0.2 * marketStress + portfolio.equityExposure * 0.5 * marketStress) * horizonMultiplier;
    const commoditiesFxFactorLoss = (portfolio.bondsExposure * 0.1 * commodityFxStress + portfolio.derivativesExposure * 0.2 * commodityFxStress) * horizonMultiplier;

    const totalFactorLoss = rateFactorLoss + spreadFactorLoss + pdFactorLoss + liquidityFactorLoss + inflationFactorLoss + marketEquityFactorLoss + commoditiesFxFactorLoss;
    const interactionResidual = Math.max(0, absoluteLoss - Math.max(0, totalFactorLoss));

    const attributionResult = {
      loansLoss: parseFloat(rawLoansLoss.toFixed(2)),
      bondsLoss: parseFloat(rawBondsLoss.toFixed(2)),
      derivativesLoss: parseFloat(rawDerivativesLoss.toFixed(2)),
      equityLoss: parseFloat(rawEquityLoss.toFixed(2)),
      factors: [
        { factor: 'interest_rate', loss: parseFloat(rateFactorLoss.toFixed(2)) },
        { factor: 'spread', loss: parseFloat(spreadFactorLoss.toFixed(2)) },
        { factor: 'default_probability', loss: parseFloat(pdFactorLoss.toFixed(2)) },
        { factor: 'liquidity', loss: parseFloat(liquidityFactorLoss.toFixed(2)) },
        { factor: 'inflation', loss: parseFloat(inflationFactorLoss.toFixed(2)) },
        { factor: 'market_equity', loss: parseFloat(marketEquityFactorLoss.toFixed(2)) },
        { factor: 'commodities_fx', loss: parseFloat(commoditiesFxFactorLoss.toFixed(2)) }
      ],
      interaction_residual: parseFloat(interactionResidual.toFixed(2))
    };

    const run = await prisma.stressTestRun.create({
      data: {
        portfolio_id: portfolioId,
        scenario_id: scenarioId || null,
        event_id: eventId || null,
        parameters_used: resolvedParameters as any,
        baseline_value: baselineValue,
        stressed_value: stressedValue,
        absolute_loss: absoluteLoss,
        risk_score: riskScore,
        attribution_result: attributionResult as any
      }
    });

    return {
      id: run.id,
      run_id: run.id,
      runId: run.id,
      portfolio_id: run.portfolio_id,
      scenario_id: run.scenario_id,
      event_id: run.event_id,
      baseline_value: Number(run.baseline_value),
      stressed_value: Number(run.stressed_value),
      absolute_loss: Number(run.absolute_loss),
      risk_score: Number(run.risk_score),
      attribution_result: run.attribution_result,
      parameters_used: run.parameters_used,
      executed_at: run.executed_at
    };
  }

  async getHistory() {
    const runs = await prisma.stressTestRun.findMany({
      orderBy: { executed_at: 'desc' },
      take: 20,
      include: { scenario: true, event: true }
    });

    return runs.map(r => {
      const params = r.parameters_used as any;
      const paramSource = params?.parameter_source || (r.event_id ? 'event_derived' : r.scenario_id ? 'preset' : 'manual');
      return {
        id: r.id,
        runId: r.id,
        run_id: r.id,
        scenario: r.scenario?.name || params?.scenario_name || (paramSource === 'manual' ? 'Manual Stress Test' : 'Custom Stress'),
        event: r.event ? { id: r.event.id, title: r.event.title, category: r.event.category, impact: Number((r.event as any).impact ?? 5.0) } : null,
        parameters: r.parameters_used,
        parameterSource: paramSource,
        baselineValue: Number(r.baseline_value),
        stressedValue: Number(r.stressed_value),
        absoluteLoss: Number(r.absolute_loss),
        loss: Number(r.absolute_loss),
        riskScore: Number(r.risk_score),
        executedAt: r.executed_at,
        completedAt: r.executed_at ? new Date(r.executed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'
      };
    });
  }

  async getRunById(id: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || typeof id !== 'string' || !uuidRegex.test(id)) return null;

    const r = await prisma.stressTestRun.findUnique({
      where: { id },
      include: { scenario: true, event: true }
    });

    if (!r) return null;

    return {
      id: r.id,
      run_id: r.id,
      runId: r.id,
      portfolio_id: r.portfolio_id,
      scenario_id: r.scenario_id,
      event_id: r.event_id,
      scenarioName: r.scenario?.name || 'Custom Stress',
      eventTitle: r.event?.title || null,
      baseline_value: Number(r.baseline_value),
      stressed_value: Number(r.stressed_value),
      absolute_loss: Number(r.absolute_loss),
      risk_score: Number(r.risk_score),
      attribution_result: r.attribution_result,
      parameters_used: r.parameters_used,
      executed_at: r.executed_at
    };
  }
}

export const riskEngineService = new RiskEngineService();
