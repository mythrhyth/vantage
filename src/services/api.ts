import type { 
  RiskEvent, 
  Portfolio, 
  AssetHolding, 
  ProposedWeight, 
  StressTestParameters, 
  StressTestRun 
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `API request failed with status ${response.status}`);
  }

  return response.json();
}

export const riskApi = {
  getEvents: (portfolioId?: string, filters?: { category?: string; horizon?: string; sentiment?: number; impact?: number; source?: string; freshness?: string }) => {
    const params = new URLSearchParams();
    if (portfolioId) params.append('portfolioId', portfolioId);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.horizon) params.append('horizon', filters.horizon);
    if (filters?.source) params.append('source', filters.source);
    if (filters?.freshness) params.append('freshness', filters.freshness);
    if (filters?.sentiment !== undefined) params.append('sentiment', filters.sentiment.toString());
    if (filters?.impact !== undefined) params.append('impact', filters.impact.toString());
    return fetchApi<RiskEvent[]>(`/events?${params.toString()}`);
  },

  getEvent: (id: string) => fetchApi<RiskEvent>(`/events/${id}`),

  runIngestion: (window?: string) => fetchApi<{ success: boolean; message: string; stats?: Record<string, unknown> }>(`/ingest`, { 
    method: 'POST',
    body: JSON.stringify({ window })
  }),

  getSources: () => fetchApi<Array<{ id: string; name: string; enabled: boolean; type?: string }>>(`/ingestion/sources`),

  toggleSource: (id: string, enabled: boolean) =>
    fetchApi<{ id: string; enabled: boolean }>(`/ingestion/sources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled })
    }),

  updateSource: (id: string, data: Record<string, unknown>) =>
    fetchApi<Record<string, unknown>>(`/ingestion/sources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  getSettings: () => fetchApi<Record<string, unknown>>(`/ingestion/settings`),

  updateSettings: (data: Record<string, unknown>) =>
    fetchApi<Record<string, unknown>>(`/ingestion/settings`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  analyzeEvent: (payload: { text: string; source: string; timestamp?: string }) =>
    fetchApi<RiskEvent>(`/events/analyze`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  getPortfolios: () => fetchApi<Portfolio[]>(`/portfolios`),

  getPortfolio: (id: string) => fetchApi<Portfolio>(`/portfolios/${id}`),

  updatePortfolio: (id: string, data: {
    name?: string;
    baselineValue?: number;
    indexUniverse?: string;
    loansExposure?: number;
    bondsExposure?: number;
    derivativesExposure?: number;
  }) => fetchApi<Portfolio>(`/portfolios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  updateHoldings: (id: string, holdings: Array<{
    ticker: string;
    company: string;
    currentWeight: number;
    sector?: string;
  }>) => fetchApi<{ success: boolean; holdings: AssetHolding[] }>(`/portfolios/${id}/holdings`, {
    method: 'PUT',
    body: JSON.stringify({ holdings })
  }),

  getPortfolioAssets: (portfolioId: string) => fetchApi<AssetHolding[]>(`/portfolio/${portfolioId}/assets`),

  getScenarios: () => fetchApi<Array<{ id: string; name: string; description?: string; parameters: StressTestParameters }>>(`/scenarios`),

  getScenario: (id: string) => fetchApi<{ id: string; name: string; parameters: StressTestParameters }>(`/scenarios/${id}`),

  simulateAllocation: (portfolioId: string, sensitivity: number, maxWeight: number, maxChange: number, sectorLimit?: number, frequency?: string, transactionCostBps?: number) => 
    fetchApi<{ runId?: string; proposed_weights: ProposedWeight[]; proposedWeights: ProposedWeight[]; trace: any; isSimulated: boolean; isApplied: boolean }>(`/allocations/simulate`, {
      method: 'POST',
      body: JSON.stringify({ portfolio_id: portfolioId, sensitivity, maxWeight, maxChange, sectorLimit, frequency, transactionCostBps })
    }),

  getAllocationHistory: (portfolioId: string, limit: number = 20) =>
    fetchApi<Array<{
      id: string;
      portfolioId: string;
      timestamp: string;
      sensitivity: number;
      maxWeight: number;
      maxChange: number;
      sectorLimit: number;
      frequency: string;
      transactionCostBps: number;
      turnover: number;
      transactionCostVal: number;
      isSimulated: boolean;
      isApplied: boolean;
      traceSummary: any;
      items: any[];
    }>>(`/allocations/history?portfolio_id=${encodeURIComponent(portfolioId)}&limit=${limit}`),

  applyAllocation: (portfolioId: string, sensitivity: number, maxWeight: number, maxChange: number, sectorLimit?: number, frequency?: string, transactionCostBps?: number) =>
    fetchApi<{ success: boolean; message: string; runId?: string; result: any }>(`/allocations/apply`, {
      method: 'POST',
      body: JSON.stringify({ portfolio_id: portfolioId, sensitivity, maxWeight, maxChange, sectorLimit, frequency, transactionCostBps })
    }),

  generateParameters: (eventId: string, scenarioId: string) =>
    fetchApi<{ parameters: StressTestParameters }>(`/stress-tests/generate-parameters`, {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId, scenario_id: scenarioId })
    }),

  runStressTest: (portfolioId: string, parameters: StressTestParameters, scenarioId?: string, eventId?: string, persist: boolean = true, runType?: string) =>
    fetchApi<StressTestRun>(`/stress-tests/run`, {
      method: 'POST',
      body: JSON.stringify({ portfolio_id: portfolioId, parameters, scenario_id: scenarioId, event_id: eventId, persist, run_type: runType })
    }),

  getStressHistory: () => fetchApi<StressTestRun[]>(`/stress-tests/history`),

  getStressRun: (id: string) => fetchApi<StressTestRun>(`/stress-tests/${id}`)
};

