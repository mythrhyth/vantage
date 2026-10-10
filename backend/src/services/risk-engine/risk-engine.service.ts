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
  async runStressTest(
    portfolioId: string,
    parameters: {
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
      parameter_source?: string;
      parameterSource?: string;
      run_type?: string;
      runType?: string;
      scenario_name?: string;
      scenarioName?: string;
    } = {},
    scenarioId?: string,
    eventId?: string,
    persist: boolean = true,
    runType?: string
  ) {
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
    let horizonVal = resolvedParameters.horizon ? String(resolvedParameters.horizon) : '1-Year';
    let years = 1.0;
    const hStr = horizonVal.toLowerCase();
    if (hStr.includes('3')) years = 0.25;
    else if (hStr.includes('6')) years = 0.5;
    else if (hStr.includes('24') || hStr.includes('2 year')) years = 2.0;
    else years = 1.0;

    const horizonMultiplier = Math.sqrt(years);

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

    const calculationTrace = {
      horizon: horizonVal,
      horizon_years: years,
      horizon_multiplier: parseFloat(horizonMultiplier.toFixed(4)),
      exposures: {
        loans: portfolio.loansExposure,
        bonds: portfolio.bondsExposure,
        derivatives: portfolio.derivativesExposure,
        equity: portfolio.equityExposure,
        total: baselineValue
      },
      shocks: {
        rate: { input: resolvedParameters.rate ?? resolvedParameters.rates ?? 0, unit: 'bps', decimal: rateShift },
        spread: { input: resolvedParameters.spread ?? 0, unit: 'bps', decimal: spreadShift },
        probability: { input: resolvedParameters.probability ?? 0, unit: '%', decimal: pdShift },
        liquidity: { input: resolvedParameters.liquidity ?? 0, unit: '%', decimal: liquidityHaircut },
        inflation: { input: resolvedParameters.inflation ?? 0, unit: 'bps', decimal: inflationShift },
        sp: { input: resolvedParameters.sp ?? 100, unit: '% baseline', decimal: spShift },
        emerging: { input: resolvedParameters.emerging ?? 100, unit: '% baseline', decimal: emergingShift },
        technology: { input: resolvedParameters.technology ?? 100, unit: '% baseline', decimal: techShift },
        oil: { input: resolvedParameters.oil ?? 100, unit: '% baseline', decimal: oilShift },
        gold: { input: resolvedParameters.gold ?? 100, unit: '% baseline', decimal: goldShift },
        dollar: { input: resolvedParameters.dollar ?? 100, unit: '% baseline', decimal: dollarShift }
      },
      drivers: [
        {
          driver_key: 'interest_rate',
          label: 'Interest-Rate Shock',
          raw_input: `${rateShift >= 0 ? '+' : ''}${Math.round(rateShift * 10000)} bps`,
          normalized_val: rateShift,
          affected_asset_classes: ['Bonds', 'Derivatives', 'Loans', 'Equity'],
          affected_exposure: portfolio.bondsExposure + portfolio.derivativesExposure + portfolio.loansExposure + portfolio.equityExposure,
          formula: 'Bonds (0.50 × Δr) + Deriv (0.20 × |Δr|) + Loans (0.10 × Δr) + Equity (0.20 × Δr)',
          modeled_loss: parseFloat(rateFactorLoss.toFixed(2)),
          is_shared: true,
          assumptions: 'Fixed income durations scale with rate shifts; equity & derivative valuations reflect discount rate adjustments.'
        },
        {
          driver_key: 'spread',
          label: 'Credit-Spread Shock',
          raw_input: `+${Math.round(spreadShift * 10000)} bps`,
          normalized_val: spreadShift,
          affected_asset_classes: ['Loans', 'Bonds'],
          affected_exposure: portfolio.loansExposure + portfolio.bondsExposure,
          formula: 'Loans (0.40 × Δs) + Bonds (0.20 × Δs)',
          modeled_loss: parseFloat(spreadFactorLoss.toFixed(2)),
          is_shared: true,
          assumptions: 'Credit risk premium expansion reduces loan valuation and corporate bond prices.'
        },
        {
          driver_key: 'default_probability',
          label: 'Default-Probability Adjustment',
          raw_input: `${(pdShift * 100).toFixed(1)}%`,
          normalized_val: pdShift,
          affected_asset_classes: ['Loans'],
          affected_exposure: portfolio.loansExposure,
          formula: 'Loans (0.40 × ΔPD)',
          modeled_loss: parseFloat(pdFactorLoss.toFixed(2)),
          is_shared: false,
          assumptions: 'Expected credit default loss on banking loan books.'
        },
        {
          driver_key: 'liquidity',
          label: 'Liquidity Haircut',
          raw_input: `${(liquidityHaircut * 100).toFixed(1)}%`,
          normalized_val: liquidityHaircut,
          affected_asset_classes: ['Derivatives', 'Equity'],
          affected_exposure: portfolio.derivativesExposure + portfolio.equityExposure,
          formula: 'Derivatives (0.60 × H_liq) + Equity (0.10 × H_liq)',
          modeled_loss: parseFloat(liquidityFactorLoss.toFixed(2)),
          is_shared: true,
          assumptions: 'Market illiquidity haircuts apply to derivative unwinds and equity liquidations.'
        },
        {
          driver_key: 'inflation',
          label: 'Inflation Shock',
          raw_input: `${inflationShift >= 0 ? '+' : ''}${Math.round(inflationShift * 10000)} bps`,
          normalized_val: inflationShift,
          affected_asset_classes: ['Bonds', 'Equity'],
          affected_exposure: portfolio.bondsExposure + portfolio.equityExposure,
          formula: 'Bonds (0.20 × Δπ) + Equity (0.20 × Δπ)',
          modeled_loss: parseFloat(inflationFactorLoss.toFixed(2)),
          is_shared: true,
          assumptions: 'Purchasing power erosion & real interest rate shifts impact bond yields and equity discount rates.'
        },
        {
          driver_key: 'market_equity',
          label: 'Equity & Market Shock',
          raw_input: `${(marketStress * 100).toFixed(1)}% stress`,
          normalized_val: marketStress,
          affected_asset_classes: ['Equity', 'Loans'],
          affected_exposure: portfolio.equityExposure + portfolio.loansExposure,
          formula: 'Equity (0.50 × M_stress) + Loans (0.20 × M_stress)',
          modeled_loss: parseFloat(marketEquityFactorLoss.toFixed(2)),
          is_shared: true,
          assumptions: 'Stock market declines impact equity portfolio holdings and corporate borrower equity collateral.'
        },
        {
          driver_key: 'commodities_fx',
          label: 'Commodities & FX Volatility',
          raw_input: `${(commodityFxStress * 100).toFixed(1)}% stress`,
          normalized_val: commodityFxStress,
          affected_asset_classes: ['Derivatives', 'Bonds'],
          affected_exposure: portfolio.derivativesExposure + portfolio.bondsExposure,
          formula: 'Derivatives (0.20 × C_stress) + Bonds (0.10 × C_stress)',
          modeled_loss: parseFloat(commoditiesFxFactorLoss.toFixed(2)),
          is_shared: true,
          assumptions: 'Energy price spikes and exchange rate volatility impact derivative hedges and foreign currency bond values.'
        }
      ]
    };

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
      interaction_residual: parseFloat(interactionResidual.toFixed(2)),
      calculation_trace: calculationTrace
    };

    // Determine strict run identity metadata
    const explicitRunType = runType || parameters?.run_type || parameters?.runType;
    const computedParamSource = resolvedParameters.parameter_source || parameterSource || (eventId ? 'event_derived' : scenarioId ? 'preset' : 'manual');
    const computedRunType = explicitRunType || (eventId ? 'event_driven' : scenarioId ? 'preset' : (computedParamSource === 'manual' ? 'manual' : computedParamSource === 'default' ? 'default' : 'manual'));

    const units = {
      rate: 'bps',
      spread: 'bps',
      inflation: 'bps',
      liquidity: '%',
      probability: '%',
      sp: '% baseline',
      emerging: '% baseline',
      technology: '% baseline',
      oil: '% baseline',
      gold: '% baseline',
      dollar: '% baseline'
    };

    let scenarioName: string | undefined = undefined;
    if (scenarioId) {
      const scenObj = await prisma.scenario.findUnique({ where: { id: scenarioId } });
      if (scenObj) scenarioName = scenObj.name;
    } else if (resolvedParameters?.scenario_name || resolvedParameters?.scenarioName) {
      scenarioName = resolvedParameters?.scenario_name || resolvedParameters?.scenarioName;
    }

    let eventTitle: string | undefined = undefined;
    if (eventId) {
      const evtObj = await prisma.riskEvent.findUnique({ where: { id: eventId } });
      if (evtObj) eventTitle = evtObj.title;
    }

    const enrichedParameters = {
      ...resolvedParameters,
      run_type: computedRunType,
      parameter_source: computedParamSource,
      units,
      ...(scenarioName ? { scenario_name: scenarioName } : {}),
      ...(eventTitle ? { event_title: eventTitle } : {})
    };

    if (!persist) {
      return {
        id: null,
        run_id: null,
        runId: null,
        portfolio_id: portfolioId,
        scenario_id: scenarioId || null,
        event_id: eventId || null,
        run_type: computedRunType,
        parameter_source: computedParamSource,
        persisted: false,
        baseline_value: baselineValue,
        stressed_value: stressedValue,
        absolute_loss: absoluteLoss,
        risk_score: riskScore,
        attribution_result: attributionResult,
        parameters_used: enrichedParameters,
        executed_at: new Date()
      };
    }

    const run = await prisma.stressTestRun.create({
      data: {
        portfolio_id: portfolioId,
        scenario_id: scenarioId || null,
        event_id: eventId || null,
        parameters_used: enrichedParameters as any,
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
      run_type: computedRunType,
      parameter_source: computedParamSource,
      persisted: true,
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
      take: 50,
      include: { scenario: true, event: true, portfolio: true }
    });

    return runs.map(r => {
      const params = (r.parameters_used as any) || {};

      let runType: 'manual' | 'preset' | 'event_driven' | 'default' | 'unknown' = 'unknown';
      let displayTitle = 'Legacy Run · Origin Unknown';
      let parameterSource = params?.parameter_source || 'unknown';

      if (r.event_id && r.event) {
        runType = 'event_driven';
        parameterSource = 'event_derived';
        displayTitle = `Event · ${r.event.title}`;
      } else if (r.scenario_id && r.scenario) {
        runType = 'preset';
        parameterSource = 'preset';
        displayTitle = `Preset · ${r.scenario.name}`;
      } else if (params?.run_type === 'manual' || params?.parameter_source === 'manual') {
        runType = 'manual';
        parameterSource = 'manual';
        displayTitle = 'Manual · Custom Parameters';
      } else if (params?.run_type === 'preset' && (params?.scenario_name || params?.scenarioName)) {
        runType = 'preset';
        parameterSource = 'preset';
        displayTitle = `Preset · ${params.scenario_name || params.scenarioName}`;
      } else if (params?.run_type === 'default' || params?.parameter_source === 'default') {
        runType = 'default';
        parameterSource = 'default';
        displayTitle = 'Default Parameters';
      } else if (params && typeof params === 'object' && Object.keys(params).length > 0 && !params?.parameter_source && !r.event_id && !r.scenario_id) {
        runType = 'unknown';
        parameterSource = 'unknown';
        displayTitle = 'Legacy Run · Origin Unknown';
      }

      return {
        id: r.id,
        runId: r.id,
        run_id: r.id,
        portfolio_id: r.portfolio_id,
        portfolio_name: r.portfolio?.name || 'Primary Financial Intelligence Portfolio',
        scenario_id: r.scenario_id,
        event_id: r.event_id,
        run_type: runType,
        displayTitle: displayTitle,
        scenario: displayTitle,
        event: r.event ? { id: r.event.id, title: r.event.title, category: r.event.category, impact: Number((r.event as any).impact ?? 5.0) } : null,
        parameters: r.parameters_used,
        parameterSource: parameterSource,
        baselineValue: Number(r.baseline_value),
        stressedValue: Number(r.stressed_value),
        absoluteLoss: Number(r.absolute_loss),
        loss: Number(r.absolute_loss),
        riskScore: Number(r.risk_score),
        attributionResult: r.attribution_result,
        executedAt: r.executed_at,
        status: 'Completed',
        completedAt: r.executed_at ? new Date(r.executed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recently'
      };
    });
  }

  async getRunById(id: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || typeof id !== 'string' || !uuidRegex.test(id)) return null;

    const r = await prisma.stressTestRun.findUnique({
      where: { id },
      include: { scenario: true, event: true, portfolio: true }
    });

    if (!r) return null;

    const params = (r.parameters_used as any) || {};
    let runType: 'manual' | 'preset' | 'event_driven' | 'default' | 'unknown' = 'unknown';
    let displayTitle = 'Legacy Run · Origin Unknown';

    if (r.event_id && r.event) {
      runType = 'event_driven';
      displayTitle = `Event · ${r.event.title}`;
    } else if (r.scenario_id && r.scenario) {
      runType = 'preset';
      displayTitle = `Preset · ${r.scenario.name}`;
    } else if (params?.run_type === 'manual' || params?.parameter_source === 'manual') {
      runType = 'manual';
      displayTitle = 'Manual · Custom Parameters';
    } else if (params?.run_type === 'preset' && (params?.scenario_name || params?.scenarioName)) {
      runType = 'preset';
      displayTitle = `Preset · ${params.scenario_name || params.scenarioName}`;
    } else if (params?.run_type === 'default' || params?.parameter_source === 'default') {
      runType = 'default';
      displayTitle = 'Default Parameters';
    }

    return {
      id: r.id,
      run_id: r.id,
      runId: r.id,
      portfolio_id: r.portfolio_id,
      portfolio_name: r.portfolio?.name || 'Primary Financial Intelligence Portfolio',
      scenario_id: r.scenario_id,
      event_id: r.event_id,
      run_type: runType,
      displayTitle: displayTitle,
      scenarioName: r.scenario?.name || (params?.scenario_name || displayTitle),
      eventTitle: r.event?.title || null,
      baseline_value: Number(r.baseline_value),
      stressed_value: Number(r.stressed_value),
      absolute_loss: Number(r.absolute_loss),
      risk_score: Number(r.risk_score),
      attribution_result: r.attribution_result,
      parameters_used: r.parameters_used,
      executed_at: r.executed_at,
      status: 'Completed'
    };
  }
}

export const riskEngineService = new RiskEngineService();
