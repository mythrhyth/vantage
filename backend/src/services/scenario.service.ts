import { prisma } from '../db';

export class ScenarioService {
  async listScenarios() {
    return prisma.scenario.findMany();
  }

  async getScenario(id: string) {
    return prisma.scenario.findUnique({ where: { id } });
  }

  async generateEventStressParameters(eventId: string, scenarioId: string) {
    const event = await prisma.riskEvent.findUnique({ where: { id: eventId } });
    const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });

    if (!event || !scenario) {
      throw { status: 404, code: 'NOT_FOUND', message: 'Event or Scenario not found' };
    }

    const impact = Number(event.impact);
    const sentiment = Number(event.sentiment);

    if (event.category === "Monetary policy") {
      return { rate: 250, spread: 120, probability: 2, liquidity: 8, inflation: 150 };
    }
    if (event.category === "Credit") {
      return {
        rate: -50,
        spread: Math.round(impact * 50),
        probability: Number((impact * 0.8).toFixed(1)),
        liquidity: Math.round(impact * 2),
        inflation: Math.round(sentiment * -50),
      };
    }
    if (event.category === "Commodities") {
      return {
        rate: Math.round(impact * 14),
        spread: Math.round(impact * 20),
        probability: Number((impact * 0.45).toFixed(1)),
        liquidity: Math.round(impact * 1.5),
        inflation: Math.round(impact * 41),
      };
    }
    if (event.category === "Earnings" || event.category === "Sector outlook") {
      const severity = impact / 10;
      return {
        rate: Math.round(-75 * severity),
        spread: Math.round(250 * severity),
        probability: Number((5 * severity).toFixed(1)),
        liquidity: Math.round(20 * severity),
        inflation: Math.round(-50 * severity),
      };
    }

    const severity = Math.max(0.55, impact / 8);
    return {
      rate: Math.round(Number(scenario.rate) * severity),
      spread: Math.round(Number(scenario.spread) * severity),
      probability: Number((Number(scenario.probability) * severity).toFixed(1)),
      liquidity: Math.round(Number(scenario.liquidity) * severity),
      inflation: Math.round(Number(scenario.inflation) * severity),
    };
  }
}
