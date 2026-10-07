import { prisma } from '../db';

interface StressParameters {
  rate: number;
  spread: number;
  probability: number;
  liquidity: number;
  inflation: number;
}

export class RiskEngineService {
  async runStressTest(portfolioId: string, parameters: StressParameters, scenarioId?: string, eventId?: string) {
    const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!portfolio) {
      throw { status: 404, code: 'NOT_FOUND', message: 'Portfolio not found' };
    }

    // Scenario Loss formula (from utils/index.ts calculateScenarioLoss)
    const absolute_loss = Math.max(
      12,
      parameters.rate * 0.07 +
        parameters.spread * 0.09 +
        parameters.probability * 5.8 +
        parameters.liquidity * 1.5 +
        parameters.inflation * 0.025
    );

    const baseline_value = Number(portfolio.baseline_value);
    const stressed_value = baseline_value - absolute_loss;

    // Risk Score
    const risk_score = Math.min(100, Math.round(absolute_loss * 0.75));

    // Loss attribution
    const attribution = {
      Loans: Number((absolute_loss * 0.56).toFixed(1)),
      Bonds: Number((absolute_loss * 0.31).toFixed(1)),
      Derivatives: Number((absolute_loss * 0.13).toFixed(1))
    };

    // Store history
    const run = await prisma.stressTestRun.create({
      data: {
        portfolio_id: portfolio.id,
        scenario_id: scenarioId || null,
        event_id: eventId || null,
        parameters_used: parameters as any,
        baseline_value,
        stressed_value,
        absolute_loss,
        risk_score,
        attribution_result: attribution as any
      }
    });

    return {
      run_id: run.id,
      baseline_value,
      stressed_value,
      absolute_loss,
      loss_percentage: (absolute_loss / baseline_value) * 100,
      risk_score,
      attribution,
      parameters
    };
  }

  async getHistory() {
    const runs = await prisma.stressTestRun.findMany({
      orderBy: { executed_at: 'desc' }
    });
    return runs;
  }

  async getRun(id: string) {
    const r = await prisma.stressTestRun.findUnique({ where: { id } });
    if (!r) return null;
    return r;
  }
}
