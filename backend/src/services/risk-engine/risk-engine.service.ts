import { prisma } from '../../db';
import { portfolioService } from '../portfolios/portfolio.service';

export class RiskEngineService {
  async runStressTest(portfolioId: string, parameters: { rate?: number; spread?: number; liquidity?: number; inflation?: number; probability?: number }, scenarioId?: string, eventId?: string) {
    const portfolio = await portfolioService.getPortfolioById(portfolioId);
    if (!portfolio) throw new Error('Portfolio not found');

    const baselineValue = portfolio.baselineValue;
    const rateShift = (parameters.rate || 0) / 100;
    const spreadShift = (parameters.spread || 0) / 100;
    const liquidityHaircut = (parameters.liquidity || 0) / 100;
    const inflationShift = (parameters.inflation || 0) / 100;

    // Asset class sensitivities
    const loansLoss = portfolio.loansExposure * (spreadShift * 0.4 + rateShift * 0.1);
    const bondsLoss = portfolio.bondsExposure * (rateShift * 0.5 + spreadShift * 0.2);
    const derivativesLoss = portfolio.derivativesExposure * (liquidityHaircut * 0.6 + rateShift * 0.2);
    const equityLoss = portfolio.equityExposure * (rateShift * 0.2 + inflationShift * 0.3 + liquidityHaircut * 0.1);

    const absoluteLoss = Math.max(0, loansLoss + bondsLoss + derivativesLoss + equityLoss);
    const stressedValue = Math.max(0, baselineValue - absoluteLoss);
    const riskScore = Math.min(100, Math.round((absoluteLoss / baselineValue) * 100 * 5));

    const attributionResult = {
      loansLoss,
      bondsLoss,
      derivativesLoss,
      equityLoss,
      factors: [
        { factor: 'interest_rate', loss: rateShift * baselineValue * 0.05 },
        { factor: 'spread', loss: spreadShift * baselineValue * 0.04 },
        { factor: 'liquidity', loss: liquidityHaircut * baselineValue * 0.03 },
        { factor: 'inflation', loss: inflationShift * baselineValue * 0.03 }
      ],
      interaction_residual: Math.max(0, absoluteLoss * 0.05)
    };

    const run = await prisma.stressTestRun.create({
      data: {
        portfolio_id: portfolioId,
        scenario_id: scenarioId || null,
        event_id: eventId || null,
        parameters_used: parameters as any,
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

    return runs.map(r => ({
      id: r.id,
      runId: r.id,
      run_id: r.id,
      scenario: r.scenario?.name || 'Custom Stress',
      event: r.event ? { id: r.event.id, title: r.event.title, category: r.event.category } : null,
      parameters: r.parameters_used,
      baselineValue: Number(r.baseline_value),
      stressedValue: Number(r.stressed_value),
      absoluteLoss: Number(r.absolute_loss),
      riskScore: Number(r.risk_score),
      executedAt: r.executed_at
    }));
  }

  async getRunById(id: string) {
    if (!id || typeof id !== 'string') return null;

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
