import { prisma } from '../../db';
import { RiskAnalysis, RiskAnalysisProvider, RelevanceAnalysis } from './nlp.types';
import { NlpValidationException } from './nlp.exception';
import { DevelopmentNlpProvider } from './development-nlp.provider';
import { GeminiNlpProvider } from './gemini-nlp.provider';
import { finBertSentimentAnalyzer } from './finbert-sentiment.analyzer';
import { financialContextLayer } from './financial-context';
import { phase2EventClassifier, VALID_EVENT_CATEGORIES } from './phase2-event-classifier';
import { portfolioService } from '../../services/portfolios/portfolio.service';
import { deterministicRiskEngine } from '../../services/risk-engine/deterministic-risk-engine';

export class NlpService {
  private provider: RiskAnalysisProvider;
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
    if (analysis.classificationConfidence !== undefined && (analysis.classificationConfidence < 0 || analysis.classificationConfidence > 1)) {
      throw new NlpValidationException(`Invalid classificationConfidence value: ${analysis.classificationConfidence}. Must be between 0 and 1.`);
    }
    if (analysis.impact < 0 || analysis.impact > 10) {
      throw new NlpValidationException(`Invalid impact value: ${analysis.impact}. Must be between 0 and 10.`);
    }
    if (analysis.impactConfidence < 0 || analysis.impactConfidence > 1) {
      throw new NlpValidationException(`Invalid impactConfidence value: ${analysis.impactConfidence}. Must be between 0 and 1.`);
    }

    if (!VALID_EVENT_CATEGORIES.includes(analysis.classification as any)) {
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

    if (process.env.NLP_MODE === 'development') {
      const note = 'Development NLP mode: rule-based estimates; local FinBERT and event-classifier models are disabled.';
      analysis.sentimentConfidence = Math.min(analysis.sentimentConfidence, 0.5);
      analysis.classificationConfidence = Math.min(analysis.classificationConfidence ?? 0.5, 0.5);
      analysis.impactConfidence = Math.min(analysis.impactConfidence, 0.5);
      analysis.signals.push(note);
      analysis.classificationReason = analysis.classificationReason
        ? `${analysis.classificationReason} ${note}`
        : note;
      analysis.impactReason = analysis.impactReason
        ? `${analysis.impactReason} ${note}`
        : note;
    } else {
      // Overwrite sentiment with Phase 1D FinBERT + Phase 1C FinancialContextLayer.
      try {
        const rawFinBertResult = await finBertSentimentAnalyzer.analyzeSentiment(text);
        const contextAdjusted = financialContextLayer.analyze(text, rawFinBertResult);
        analysis.sentiment = contextAdjusted.adjustedSentiment;
        analysis.sentimentConfidence = contextAdjusted.adjustedConfidence;
        console.log(`[NlpService] Phase 1D FinBERT sentiment applied: sentiment=${analysis.sentiment}, confidence=${analysis.sentimentConfidence} (raw FinBERT: ${rawFinBertResult.sentiment}, label: ${rawFinBertResult.label})`);
      } catch (finBertErr: any) {
        console.error('[NlpService] Phase 1D FinBERT inference error:', finBertErr);
        throw new Error(`Phase 1D FinBERT Integration Error: ${finBertErr.message}`);
      }

      // Overwrite event classification with the Phase 2 fine-tuned classifier.
      try {
        const phase2Result = await phase2EventClassifier.classifyEvent(text);
        const providerCategorySuggestion = analysis.classification;
        analysis.classification = phase2Result.predictedCategory;
        analysis.classificationConfidence = phase2Result.confidence;
        analysis.top2Classification = phase2Result.top2Category;
        analysis.top2Confidence = phase2Result.top2Confidence;
        analysis.categoryProbabilities = phase2Result.categoryProbabilities;

        console.log(`[NlpService] Phase 2 Event Classifier applied: category="${analysis.classification}", confidence=${analysis.classificationConfidence} (top2: "${phase2Result.top2Category}", provider suggested: "${providerCategorySuggestion}")`);

        if (providerCategorySuggestion && providerCategorySuggestion !== phase2Result.predictedCategory) {
          const note = `[Phase 2 Classifier: ${phase2Result.predictedCategory} (${(phase2Result.confidence * 100).toFixed(1)}% conf); provider suggested: ${providerCategorySuggestion}]`;
          analysis.classificationReason = analysis.classificationReason
            ? `${analysis.classificationReason} ${note}`
            : note;
        }
      } catch (phase2Err: any) {
        console.error('[NlpService] Phase 2 Event Classifier inference error:', phase2Err);
        throw new Error(`Phase 2 Event Classifier Integration Error: ${phase2Err.message}`);
      }
    }

    // Apply Deterministic Risk Engine to overwrite impact score with portfolio-aware score
    try {
      const portfolios = await portfolioService.getPortfolios();
      const mainPortfolio = portfolios[0];

      const relInput = {
        relevanceType: relevance?.relevanceType || (relevance?.affectedAssets && relevance.affectedAssets.length > 0 ? 'DIRECT' : 'PORTFOLIO_WIDE'),
        relevanceScore: relevance?.relevanceScore || 1.0,
        matchedHoldingIds: relevance?.affectedAssets || [],
        matchedSectors: relevance?.affectedAssets || []
      };

      const rawAssets = (mainPortfolio?.assets && mainPortfolio.assets.length > 0)
        ? mainPortfolio.assets
        : (mainPortfolio?.holdings || []);

      const portInput = mainPortfolio ? {
        portfolioId: mainPortfolio.id,
        baselineValue: mainPortfolio.baselineValue || Number(mainPortfolio.baseline_value) || 1000.0,
        holdings: rawAssets.map((a: any) => ({
          assetId: a.id,
          ticker: a.ticker || undefined,
          company: a.company || undefined,
          assetClass: (a.assetType || a.asset_type || '').toUpperCase() as any,
          sector: a.sector || undefined,
          currentValue: (a.exposureValue && Number(a.exposureValue) > 0) ? Number(a.exposureValue) : ((a.exposure_value && Number(a.exposure_value) > 0) ? Number(a.exposure_value) : 0),
          currentWeight: a.currentWeight !== undefined ? Number(a.currentWeight) : (a.current_weight !== undefined ? Number(a.current_weight) : 0)
        }))
      } : {
        portfolioId: 'default',
        baselineValue: 1000.0,
        holdings: []
      };

      const deterministicOutput = deterministicRiskEngine.calculateRisk(
        {
          category: analysis.classification,
          classificationConfidence: analysis.classificationConfidence,
          sentiment: analysis.sentiment,
          sentimentConfidence: analysis.sentimentConfidence,
          horizon: 'SHORT_TERM'
        },
        portInput,
        relInput
      );

      console.log(`[NlpService Debug] rawAssets count: ${rawAssets.length}, sample asset:`, JSON.stringify(rawAssets[0]), `assetClassWeights:`, deterministicOutput.assetClassWeights);

      analysis.impact = deterministicOutput.portfolioImpact;
      analysis.impactConfidence = deterministicOutput.modelConfidence;

      const detNote = `[Deterministic Engine: S_event=${deterministicOutput.eventSeverity.toFixed(2)}, I_portfolio=${deterministicOutput.portfolioImpact.toFixed(2)}, E_stress=${deterministicOutput.stressExposure.toFixed(4)}]`;
      analysis.impactReason = analysis.impactReason ? `${analysis.impactReason} ${detNote}` : detNote;

      console.log(`[NlpService] Deterministic Risk Engine applied: Portfolio Impact=${analysis.impact} (Event Severity=${deterministicOutput.eventSeverity}, Stress Exposure=${deterministicOutput.stressExposure})`);
    } catch (detErr: any) {
      console.warn('[NlpService] Deterministic Risk Engine calculation warning:', detErr);
    }

    if (process.env.NLP_MODE === 'development') {
      analysis.impactConfidence = Math.min(analysis.impactConfidence, 0.5);
    }

    // Validate NLP Output
    this.validateAnalysis(analysis);

    // Check for existing RiskEvent with identical title to prevent duplicate creation
    const existingEvent = await prisma.riskEvent.findFirst({
      where: {
        title: {
          equals: metadata.title.trim(),
          mode: 'insensitive'
        }
      },
      orderBy: { created_at: 'desc' }
    });

    if (existingEvent) {
      return existingEvent;
    }

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
        classification_confidence: analysis.classificationConfidence,
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
