import { prisma } from '../db';

export class AllocationService {
  async simulateAllocation(portfolioId: string, sensitivity: number, maxWeight: number, maxChange: number) {
    const assets = await prisma.asset.findMany({
      where: { portfolio_id: portfolioId, asset_type: 'Stock' }
    });

    const raw = assets.map((stock) =>
      Math.min(
        maxWeight,
        Number(stock.current_weight) +
          ((Number(stock.sentiment) * sensitivity) / 100) * Math.min(1.25, maxChange),
      )
    );
    
    const total = raw.reduce((sum, value) => sum + value, 0);
    const proposed = raw.map((value) => (value / total) * 100);

    return assets.map((asset, index) => ({
      asset_id: asset.id,
      ticker: asset.ticker,
      current_weight: Number(asset.current_weight),
      proposed_weight: proposed[index]
    }));
  }
}
