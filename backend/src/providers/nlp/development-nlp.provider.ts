import { RiskAnalysis, RiskAnalysisProvider } from './nlp.types';

export class DevelopmentNlpProvider implements RiskAnalysisProvider {
  async analyzeRelevance(input: { text: string; portfolioAssets: any[] }): Promise<any> {
    return {
      relevant: true,
      relevanceType: "PORTFOLIO_WIDE",
      affectedAssets: [],
      portfolioWide: true,
      relevanceScore: 0.85,
      relevanceReason: "Synthesized portfolio relevance"
    };
  }

  async analyze(input: { text: string, source: string, timestamp?: string }): Promise<RiskAnalysis> {
    const text = input.text || '';
    
    // Rule-based entity extraction fallback
    let entity = 'Global Markets';
    if (/fed|federal reserve|powell|interest rate|fomc/i.test(text)) entity = 'Federal Reserve';
    else if (/ecb|european central bank|lagarde|schnabel/i.test(text)) entity = 'European Central Bank';
    else if (/israel|gaza|palestinian|middle east|war|strike/i.test(text)) entity = 'Middle East Geopolitics';
    else if (/nvidia|nvda|chip|ai|spacex|tech/i.test(text)) entity = 'Nvidia & Technology Sector';
    else if (/oil|crude|energy|brent|wti/i.test(text)) entity = 'Energy & Commodity Markets';
    else if (/dollar|usd|treasury|bond|yield/i.test(text)) entity = 'US Treasury & FX Markets';
    else if (input.source) entity = `${input.source} Intelligence Unit`;

    return {
      title: input.text.substring(0, 60),
      entity,
      classification: /rate|fed|ecb|inflation/i.test(text) ? "Monetary policy" : /war|israel|military|strike/i.test(text) ? "Geopolitical" : "Sector outlook",
      sentiment: /rise|gain|positive|survive/i.test(text) ? 0.35 : -0.45,
      sentimentConfidence: 0.85,
      impact: 6.5,
      impactConfidence: 0.90,
      impactReason: `Rule-assessed market impact based on key headline indicators from ${input.source || 'ingested feed'}.`,
      classificationReason: `Classified based on primary financial domain keyphrase mapping.`,
      signals: ["Financial news feed signal", "Market sentiment indicator"],
      sentimentDrivers: ["Macroeconomic headline trend", "Market price risk premium"],
      impactFactors: [["Market Exposure", 6.5], ["Sector Volatility", 5.0]],
      affectedAreas: [["Financial Markets", "Moderate"], ["Sector Indices", "Elevated"]],
      riskFlow: ["News release -> Volatility adjustment -> Portfolio exposure rebalanced"],
      source: input.source || "Financial Feed",
      timestamp: input.timestamp || new Date().toISOString(),
      excerpt: input.text.substring(0, 150)
    };
  }
}
