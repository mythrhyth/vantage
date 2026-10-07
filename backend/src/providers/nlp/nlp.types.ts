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
  source?: string;
  timestamp?: string;
  excerpt?: string;
}

export interface RelevanceAnalysis {
  relevant: boolean;
  relevanceType?: string;
  affectedAssets?: string[];
  portfolioWide?: boolean;
  relevanceScore?: number;
  relevanceReason?: string;
}

export interface RiskAnalysisProvider {
  analyze(input: { text: string; source: string; timestamp?: string }): Promise<RiskAnalysis>;
  analyzeRelevance(input: { text: string; portfolioAssets: any[] }): Promise<RelevanceAnalysis>;
}
