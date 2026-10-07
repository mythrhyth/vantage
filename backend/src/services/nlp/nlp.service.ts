import { prisma } from '../../server';
import { RiskAnalysis, RiskAnalysisProvider, RelevanceAnalysis } from './nlp.types';
import { NlpValidationException } from './nlp.exception';
import { DevelopmentNlpProvider } from './development-nlp.provider';
import { GeminiNlpProvider } from './gemini-nlp.provider';

export class NlpService {
  private fallbackProvider: DevelopmentNlpProvider;

  constructor() {
    this.fallbackProvider = new DevelopmentNlpProvider();
    const providerType = process.env.NLP_PROVIDER || 'gemini';
    if (process.env.GEMINI_API_KEY && providerType !== 'development') {
      console.log('[NlpService] Initializing Gemini NLP Provider with Google GenAI SDK');
      try {
        this.provider = new GeminiNlpProvider();
      } catch (err) {
        console.warn('[NlpService] Gemini initialization failed, using Development provider fallback:', err);
        this.provider = this.fallbackProvider;
      }
    } else {
      console.log('[NlpService] Initializing Development (Rule-based) NLP Provider');
      this.provider = this.fallbackProvider;
    }
  }

  private validateAnalysis(analysis: RiskAnalysis) {
    if (analysis.sentiment < -1 || analysis.sentiment > 1) {
      throw new NlpValidationException(`Invalid sentiment value: ${analysis.sentiment}. Must be between -1 and 1.`);
    }
    if (analysis.sentimentConfidence < 0 || analysis.sentimentConfidence > 1) {
      throw new NlpValidationException(`Invalid sentimentConfidence value: ${analysis.sentimentConfidence}. Must be between 0 and 1.`);
    }
    if (analysis.impact < 0 || analysis.impact > 10) {
      throw new NlpValidationException(`Invalid impact value: ${analysis.impact}. Must be between 0 and 10.`);
    }
    if (analysis.impactConfidence < 0 || analysis.impactConfidence > 1) {
      throw new NlpValidationException(`Invalid impactConfidence value: ${analysis.impactConfidence}. Must be between 0 and 1.`);
    }

    const validCategories = [
      'Monetary policy', 'Credit', 'Commodities', 'Earnings', 
      'Sector outlook', 'Geopolitical', 'Regulatory', 'Macroeconomic'
    ];
    if (!validCategories.includes(analysis.classification)) {
      throw new NlpValidationException(`Invalid classification: ${analysis.classification}.`);
    }
  }

  async analyzeRelevance(text: string, portfolioAssets: any[]): Promise<RelevanceAnalysis> {
    if (!text || text.trim() === '') {
      throw new NlpValidationException('Text cannot be empty.');
    }
    try {
      return await this.provider.analyzeRelevance({ text, portfolioAssets });
    } catch (e) {
      console.warn('[NlpService] Primary provider analyzeRelevance failed, using fallback:', e);
      return await this.fallbackProvider.analyzeRelevance({ text, portfolioAssets });
    }
  }

  async analyzeAndPersist(metadata: { title: string; source: string; publishedAt?: string; excerpt?: string }, text: string, relevance?: RelevanceAnalysis) {
    if (!text || text.trim() === '') {
      throw new NlpValidationException('Text cannot be empty.');
    }

    // Call NLP Provider with fallback
    let analysis: RiskAnalysis;
    try {
      analysis = await this.provider.analyze({ text, source: metadata.source, timestamp: metadata.publishedAt });
    } catch (e) {
      console.warn('[NlpService] Primary provider analyze failed, using fallback provider:', e);
      analysis = await this.fallbackProvider.analyze({ text, source: metadata.source, timestamp: metadata.publishedAt });
    }

    // Validate NLP Output
    this.validateAnalysis(analysis);

    // Transform and persist
    const event = await prisma.riskEvent.create({
      data: {
        title: metadata.title,
        entity: analysis.entity,
        category: analysis.classification,
        sentiment: analysis.sentiment,
        sentiment_confidence: analysis.sentimentConfidence,
        impact: analysis.impact,
        impact_confidence: analysis.impactConfidence,
        impact_reason: analysis.impactReason,
        classification_reason: analysis.classificationReason,
        signals: analysis.signals as any,
        sentiment_drivers: analysis.sentimentDrivers as any,
        impact_factors: analysis.impactFactors as any,
        affected_areas: analysis.affectedAreas as any,
        risk_flow: analysis.riskFlow as any,
        source: metadata.source,
        excerpt: metadata.excerpt || (text.length > 300 ? text.substring(0, 300) + '...' : text),
        horizon: '1-4 weeks',
        affected_assets: relevance?.affectedAssets || [],
        relevance_type: relevance?.relevanceType || null,
        relevance_score: relevance?.relevanceScore || null,
        relevance_reason: relevance?.relevanceReason || null,
      }
    });

    return event;
  }
}

export const nlpService = new NlpService();
