export interface RiskAnalysis {
  title: string;
  entity: string;
  classification: string;
  sentiment: number;
  sentimentConfidence: number;
  impact: number;
  impactConfidence: number;
  impactReason?: string;
  classificationReason?: string;
  signals: string[];
  sentimentDrivers: string[];
  impactFactors: [string, number][];
  affectedAreas: [string, string][];
  riskFlow: string[];
  source: string;
  timestamp?: string;
  excerpt?: string;
  relevant?: boolean;
  relevanceType?: string;
  affectedAssets?: any[];
  portfolioWide?: boolean;
  relevanceReason?: string;
  relevanceScore?: number;
}


export interface RelevanceAnalysis {
  relevant: boolean;
  relevanceType: string;
  affectedAssets: any[];
  portfolioWide: boolean;
  relevanceScore: number;
  relevanceReason: string;
}

export interface RiskAnalysisProvider {
  analyzeRelevance(input: { text: string; portfolioAssets: any[] }): Promise<RelevanceAnalysis>;
  analyze(input: { text: string, source: string, timestamp?: string }): Promise<RiskAnalysis>;
}

