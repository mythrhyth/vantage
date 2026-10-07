import { prisma } from '../../db';
import { eventService } from '../events/event.service';

export class ScenarioService {
  async getScenarios() {
    const scenarios = await prisma.scenario.findMany();
    if (scenarios.length === 0) {
      // Seed default scenarios
      const defaults = await prisma.scenario.createMany({
        data: [
          { name: 'Interest Rate Shock', rate: 250, spread: 120, probability: 2, liquidity: 8, inflation: 150 },
          { name: 'Credit Crisis', rate: -50, spread: 350, probability: 8, liquidity: 20, inflation: 50 },
          { name: 'Combined Macro Stress', rate: 150, spread: 250, probability: 5, liquidity: 15, inflation: 200 }
        ]
      });
      return prisma.scenario.findMany();
    }
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

  async generateEventStressParameters(eventId: string, scenarioId: string) {
    const event = await eventService.getEventById(eventId);
    const scenario = await this.getScenarioById(scenarioId);

    if (!event || !scenario) {
      throw new Error('Event or Scenario not found');
    }

    const impactMultiplier = event.impact / 5;
    const sentimentSign = event.sentiment >= 0 ? -1 : 1;

    return {
      rate: Math.round(scenario.rate * impactMultiplier * sentimentSign),
      spread: Math.round(scenario.spread * impactMultiplier),
      probability: Math.round(scenario.probability * impactMultiplier),
      liquidity: Math.round(scenario.liquidity * impactMultiplier),
      inflation: Math.round(scenario.inflation * impactMultiplier * sentimentSign)
    };
  }
}

export const scenarioService = new ScenarioService();
