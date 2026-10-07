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
    return fetchApi<any[]>(`/events?${params.toString()}`);
  },

  getEvent: (id: string) => fetchApi<any>(`/events/${id}`),

  runIngestion: (window?: string) => fetchApi<{ success: boolean; message: string; stats?: any }>(`/ingest`, { 
    method: 'POST',
    body: JSON.stringify({ window })
  }),

  getSources: () => fetchApi<any[]>(`/ingestion/sources`),

  toggleSource: (id: string, enabled: boolean) =>
    fetchApi<any>(`/ingestion/sources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled })
    }),

  updateSource: (id: string, data: any) =>
    fetchApi<any>(`/ingestion/sources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  getSettings: () => fetchApi<any>(`/ingestion/settings`),

  updateSettings: (data: any) =>
    fetchApi<any>(`/ingestion/settings`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  analyzeEvent: (payload: { text: string; source: string; timestamp?: string }) =>
    fetchApi<any>(`/events/analyze`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  getPortfolios: () => fetchApi<any[]>(`/portfolios`),

  getPortfolio: (id: string) => fetchApi<any>(`/portfolios/${id}`),

  updatePortfolio: (id: string, data: {
    name?: string;
    baselineValue?: number;
    indexUniverse?: string;
    loansExposure?: number;
    bondsExposure?: number;
    derivativesExposure?: number;
  }) => fetchApi<any>(`/portfolios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  updateHoldings: (id: string, holdings: Array<{
    ticker: string;
    company: string;
    currentWeight: number;
    sector?: string;
  }>) => fetchApi<any>(`/portfolios/${id}/holdings`, {
    method: 'PUT',
    body: JSON.stringify({ holdings })
  }),

  getPortfolioAssets: (portfolioId: string) => fetchApi<any[]>(`/portfolio/${portfolioId}/assets`),

  getScenarios: () => fetchApi<any[]>(`/scenarios`),

  getScenario: (id: string) => fetchApi<any>(`/scenarios/${id}`),

  simulateAllocation: (portfolioId: string, sensitivity: number, maxWeight: number, maxChange: number) => 
    fetchApi<{ proposed_weights: any[] }>(`/allocations/simulate`, {
      method: 'POST',
      body: JSON.stringify({ portfolio_id: portfolioId, sensitivity, maxWeight, maxChange })
    }),

  generateParameters: (eventId: string, scenarioId: string) =>
    fetchApi<any>(`/stress-tests/generate-parameters`, {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId, scenario_id: scenarioId })
    }),

  runStressTest: (portfolioId: string, parameters: any, scenarioId?: string, eventId?: string) =>
    fetchApi<any>(`/stress-tests/run`, {
      method: 'POST',
      body: JSON.stringify({ portfolio_id: portfolioId, parameters, scenario_id: scenarioId, event_id: eventId })
    }),

  getStressHistory: () => fetchApi<any[]>(`/stress-tests/history`),

  getStressRun: (id: string) => fetchApi<any>(`/stress-tests/${id}`)
};
