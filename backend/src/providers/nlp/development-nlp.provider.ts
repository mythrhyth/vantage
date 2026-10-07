import { RiskAnalysis, RiskAnalysisProvider } from './nlp.types';

export class DevelopmentNlpProvider implements RiskAnalysisProvider {
  async analyzeRelevance(input: { text: string; portfolioAssets: any[] }): Promise<any> {
    const text = input.text.toLowerCase();
    const matches: string[] = [];

    (input.portfolioAssets || []).forEach(asset => {
      const ticker = (asset.ticker || '').toLowerCase();
      const company = (asset.company || '').toLowerCase();
      if ((ticker && text.includes(ticker)) || (company && text.includes(company))) {
        matches.push(asset.ticker);
      }
    });

    const isMacro = /fed|federal reserve|ecb|interest rate|inflation|war|conflict|gdp|yield|treasury|geopolit/i.test(input.text);

    return {
      relevant: matches.length > 0 || isMacro,
      relevanceType: matches.length > 0 ? "DIRECT" : isMacro ? "PORTFOLIO_WIDE" : "IRRELEVANT",
      affectedAssets: matches,
      portfolioWide: isMacro,
      relevanceScore: matches.length > 0 ? 0.90 : isMacro ? 0.85 : 0.10,
      relevanceReason: matches.length > 0 
        ? `Direct entity match for portfolio holdings: ${matches.join(', ')}`
        : isMacro 
        ? "Macroeconomic / geopolitical risk factor impacting broader portfolio exposure"
        : "Low correlation to active portfolio assets"
    };
  }

  async analyze(input: { text: string, source: string, timestamp?: string }): Promise<RiskAnalysis> {
    const text = input.text || '';
    const lower = text.toLowerCase();

    // 1. Dynamic Entity Extraction
    let entity = 'Global Markets';
    if (/fed\b|federal reserve|powell|fomc/i.test(text)) entity = 'Federal Reserve';
    else if (/ecb\b|european central bank|lagarde|schnabel/i.test(text)) entity = 'European Central Bank';
    else if (/israel|gaza|palestin|middle east|iran|war|military|strike/i.test(text)) entity = 'Middle East Geopolitics';
    else if (/spacex|musk/i.test(text)) entity = 'SpaceX';
    else if (/apple|aapl|iphone|smart-home/i.test(text)) entity = 'Apple Inc.';
    else if (/nvidia|nvda|semiconductor|ai chip/i.test(text)) entity = 'Nvidia & Technology Sector';
    else if (/amazon|alexa|boston dynamics/i.test(text)) entity = 'Amazon & Robotics';
    else if (/jpmorgan|jpm|bank|credit|distressed loans/i.test(text)) entity = 'US Credit & Banking Sector';
    else if (/oil|crude|energy|brent|wti/i.test(text)) entity = 'Energy & Commodity Markets';
    else if (/dollar|usd|treasury|bond|yield/i.test(text)) entity = 'US Treasury & FX Markets';
    else if (input.source && input.source !== 'Manual Input' && input.source !== 'Test News') {
      entity = `${input.source} Market Unit`;
    }

    // 2. Classification
    let classification = "Sector outlook";
    if (/rate|fed\b|ecb\b|inflation|fomc|monetary|central bank/i.test(text)) classification = "Monetary policy";
    else if (/war|israel|military|strike|geopolit|conflict|sanction/i.test(text)) classification = "Geopolitical";
    else if (/loan|distressed|debt|default|credit|bank|borrow|financing/i.test(text)) classification = "Credit";
    else if (/oil|gold|commodity|energy|crude/i.test(text)) classification = "Commodities";
    else if (/earnings|profit|revenue|quarterly|q1|q2|q3|q4/i.test(text)) classification = "Earnings";
    else if (/tariff|regulation|sec\b|lawsuit|investigation|probe/i.test(text)) classification = "Regulatory";
    else if (/gdp|unemployment|payroll|recession|economic/i.test(text)) classification = "Macroeconomic";

    // 3. Content-driven Sentiment Calculation
    const posKeywords = [
      "rally", "surge", "gain", "boost", "record", "profit", "soar", "stimulus", 
      "easing", "growth", "outperform", "bullish", "approval", "financing", "taps", 
      "launches", "innovation", "beats", "revenue", "demand", "rise", "positive", "survive"
    ];
    const negKeywords = [
      "mourn", "war", "strike", "conflict", "distressed", "loss", "plunge", "hike", 
      "inflation", "debt", "investigation", "probe", "lawsuit", "sanction", "default", 
      "crisis", "slump", "tariff", "turmoil", "risk", "tightening", "layoff", "fine", 
      "cut", "repay", "edge lower", "borrow", "threat", "drop", "fall", "decline"
    ];

    let posScore = 0;
    let negScore = 0;

    posKeywords.forEach(kw => {
      if (lower.includes(kw)) posScore += 0.25;
    });
    negKeywords.forEach(kw => {
      if (lower.includes(kw)) negScore += 0.30;
    });

    let rawSentiment = posScore - negScore;
    if (rawSentiment === 0) {
      // Small headline hash determinism to prevent flat 0 for unlisted text
      let hash = 0;
      for (let i = 0; i < text.length; i++) hash = (hash << 5) - hash + text.charCodeAt(i);
      rawSentiment = ((Math.abs(hash) % 40) - 20) / 100; // -0.20 to +0.20
    }

    const sentiment = Math.max(-0.95, Math.min(0.95, Number(rawSentiment.toFixed(2))));

    // 4. Content-driven Impact Calculation
    let baseImpact = 5.0;
    if (classification === "Monetary policy" || classification === "Geopolitical") baseImpact = 7.5;
    else if (classification === "Credit" || classification === "Macroeconomic") baseImpact = 7.0;
    else if (classification === "Commodities" || classification === "Regulatory") baseImpact = 6.0;
    else if (classification === "Earnings") baseImpact = 5.5;

    const sentimentSeverity = Math.abs(sentiment) * 2.0;
    let computedImpact = baseImpact + (sentiment < 0 ? sentimentSeverity * 0.8 : sentimentSeverity * 0.4);
    
    // Slight deterministic variation based on headline length
    computedImpact += (text.length % 7) * 0.15;
    const impact = Math.max(2.0, Math.min(9.8, Number(computedImpact.toFixed(1))));

    return {
      title: input.text.substring(0, 70),
      entity,
      classification,
      sentiment,
      sentimentConfidence: 0.88,
      impact,
      impactConfidence: 0.90,
      impactReason: `Rule-assessed market impact (${impact}/10) based on headline indicators for ${entity}.`,
      classificationReason: `Classified as ${classification} based on domain keyphrase extraction.`,
      signals: [`Market headline indicator for ${entity}`, `${classification} domain signal`],
      sentimentDrivers: [sentiment < 0 ? "Adverse market headline pressure" : "Favorable sentiment trend", "Keyphrase risk premium"],
      impactFactors: [["Market Exposure", Number((impact * 0.7).toFixed(1))], ["Sector Volatility", Number((impact * 0.4).toFixed(1))]],
      affectedAreas: [["Financial Markets", sentiment < 0 ? "Elevated Risk" : "Positive Momentum"], [classification, "Direct Impact"]],
      riskFlow: [`Event headline -> ${classification} adjustment -> Risk premium repriced`],
      source: input.source || "Financial Feed",
      timestamp: input.timestamp || new Date().toISOString(),
      excerpt: input.text.substring(0, 200)
    };
  }
}

