import { GoogleGenAI, Type } from '@google/genai';
import { RiskAnalysis, RiskAnalysisProvider } from './nlp.types';
import { NlpValidationException } from './nlp.exception';

export class GeminiNlpProvider implements RiskAnalysisProvider {
  private ai: GoogleGenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured. Cannot initialize GeminiNlpProvider.');
    }
    
    // Initialize the official Google Gen AI SDK
    this.ai = new GoogleGenAI({ apiKey });
    this.model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  }

  async analyzeRelevance(input: { text: string; portfolioAssets: any[] }): Promise<any> {
    const portfolioContext = input.portfolioAssets.map(a => `${a.company} (${a.ticker}) - Sector: ${a.sector}`).join('\n');
    const prompt = `You are a financial relevance filter. 
Analyze the following article and determine if it is relevant to the provided portfolio holdings.

Portfolio Holdings:
${portfolioContext}

Article Text:
"""
${input.text}
"""

Rules:
1. "relevant": true if the article directly, indirectly, or macro-economically affects any of the portfolio holdings. false otherwise.
2. "relevanceType": "DIRECT", "INDIRECT", "PORTFOLIO_WIDE", or "IRRELEVANT".
3. "affectedAssets": list of asset tickers affected (e.g. ["AAPL"]). Empty if PORTFOLIO_WIDE or IRRELEVANT.
4. "portfolioWide": boolean true if the event affects the entire portfolio (e.g., Fed rate decision, macro shock).
5. "relevanceScore": Number from 0 to 1 indicating the strength of the relevance (0 if irrelevant).
6. "relevanceReason": A short explanation of why it is relevant (or not).`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              relevant: { type: Type.BOOLEAN },
              relevanceType: { type: Type.STRING },
              affectedAssets: { type: Type.ARRAY, items: { type: Type.STRING } },
              portfolioWide: { type: Type.BOOLEAN },
              relevanceScore: { type: Type.NUMBER },
              relevanceReason: { type: Type.STRING }
            },
            required: ['relevant', 'relevanceType', 'affectedAssets', 'portfolioWide', 'relevanceScore', 'relevanceReason']
          }
        }
      });
      const rawJson = response.text;
      if (!rawJson) throw new Error('Empty response from Gemini');
      return JSON.parse(rawJson);
    } catch (e: any) {
      console.error('[GeminiNlpProvider] Relevance API error:', e);
      throw new NlpValidationException(`Failed to analyze relevance: ${e.message}`);
    }
  }

  async analyze(input: { text: string; source: string; timestamp?: string }): Promise<RiskAnalysis> {
    const prompt = `You are a financial risk event extraction and classification engine. 
Analyze the following financial/news text and extract structured risk intelligence.
The text originates from: ${input.source}
${input.timestamp ? `Published on: ${input.timestamp}` : ''}

Rules:
1. "classification" must be one of: "Monetary policy", "Credit", "Commodities", "Earnings", "Sector outlook", "Geopolitical", "Regulatory", "Macroeconomic". Pick the best fit or "Macroeconomic" if none fits well.
2. "sentiment" represents the financial/market implication of the event (between -1 and 1). -1 is extremely negative, 0 is neutral, 1 is extremely positive.
3. "sentimentConfidence" is your confidence in the sentiment score (between 0 and 1).
4. "impact" is the score from 0 to 10 (0-2 very low, 8-10 very high/systemically significant).
5. "impactConfidence" is your confidence in the impact score (between 0 and 1).
6. "signals" is a list of strings representing key signals.
7. "sentimentDrivers" is a list of strings representing the main drivers of the sentiment.
8. "impactFactors" is a list of tuples [string, number], where the number is an estimated factor weight (0-1).
9. "affectedAreas" is a list of tuples [string, string], representing [Area, Effect].
10. "riskFlow" is a list of strings explaining step-by-step how the event transmits into financial risk (e.g., Event -> Interest rates rise -> Bond prices drop).
11. Include the "source" and "timestamp" you were provided, if available.

Text to analyze:
"""
${input.text}
"""
`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              entity: { type: Type.STRING },
              classification: { type: Type.STRING },
              sentiment: { type: Type.NUMBER },
              sentimentConfidence: { type: Type.NUMBER },
              impact: { type: Type.NUMBER },
              impactConfidence: { type: Type.NUMBER },
              impactReason: { type: Type.STRING },
              classificationReason: { type: Type.STRING },
              signals: { type: Type.ARRAY, items: { type: Type.STRING } },
              sentimentDrivers: { type: Type.ARRAY, items: { type: Type.STRING } },
              impactFactors: {
                type: Type.ARRAY,
                items: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING } // Note: The schema format only allows one type for array items, so we fetch string and map it or expect arrays of [string, string(number)]
                }
              },
              affectedAreas: {
                type: Type.ARRAY,
                items: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              riskFlow: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: [
              'entity',
              'classification',
              'sentiment',
              'sentimentConfidence',
              'impact',
              'impactConfidence',
              'signals',
              'sentimentDrivers',
              'affectedAreas',
              'riskFlow'
            ]
          }
        }
      });

      const rawJson = response.text;
      if (!rawJson) {
        throw new Error('Empty response from Gemini API');
      }

      const parsed = JSON.parse(rawJson);
      
      // Fix impactFactors if they were parsed as [string, string] due to schema constraints
      const impactFactors: [string, number][] = (parsed.impactFactors || []).map((factor: any) => {
        if (Array.isArray(factor) && factor.length === 2) {
          return [String(factor[0]), Number(factor[1]) || 0];
        }
        return ['Unknown factor', 0];
      });

      const affectedAreas: [string, string][] = (parsed.affectedAreas || []).map((area: any) => {
        if (Array.isArray(area) && area.length === 2) {
          return [String(area[0]), String(area[1])];
        }
        return ['Unknown area', 'Unknown effect'];
      });

      const result: RiskAnalysis = {
        title: "", // Handled upstream
        entity: parsed.entity,
        classification: parsed.classification,
        sentiment: Number(parsed.sentiment),
        sentimentConfidence: Number(parsed.sentimentConfidence),
        impact: Number(parsed.impact),
        impactConfidence: Number(parsed.impactConfidence),
        impactReason: parsed.impactReason,
        classificationReason: parsed.classificationReason,
        signals: Array.isArray(parsed.signals) ? parsed.signals : [],
        sentimentDrivers: Array.isArray(parsed.sentimentDrivers) ? parsed.sentimentDrivers : [],
        impactFactors,
        affectedAreas,
        riskFlow: Array.isArray(parsed.riskFlow) ? parsed.riskFlow : [],
        source: input.source,
        timestamp: input.timestamp,
      };

      return result;
    } catch (e: any) {
      console.error('[GeminiNlpProvider] API or parsing error:', e);
      throw new NlpValidationException(`Failed to analyze text using Gemini: ${e.message}`);
    }
  }
}
