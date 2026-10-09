import { SentimentResult } from './nlp.types';

export interface AdjustedSentimentResult {
  rawFinBert: SentimentResult;
  adjustedSentiment: number;
  adjustedConfidence: number;
  adjustedLabel: 'positive' | 'neutral' | 'negative';
  appliedRules: string[];
  adjustedProbabilities: {
    pPos: number;
    pNeg: number;
    pNeu: number;
  };
}

export class FinancialContextLayer {
  /**
   * Evaluates raw FinBERT sentiment against financial domain rules and indicator contexts.
   * Produces a deterministic, evidence-weighted adjusted sentiment result without modifying raw FinBERT output.
   */
  public analyze(text: string, rawResult: SentimentResult): AdjustedSentimentResult {
    const appliedRules: string[] = [];
    const textLower = text.toLowerCase();

    // 1. Extract or infer starting probability distribution
    let pPos = 0;
    let pNeg = 0;
    let pNeu = 0;

    // Use raw probabilities if attached, or infer from sentiment and confidence
    const rawAny = rawResult as any;
    if (typeof rawAny.pPos === 'number' && typeof rawAny.pNeg === 'number' && typeof rawAny.pNeu === 'number') {
      pPos = rawAny.pPos;
      pNeg = rawAny.pNeg;
      pNeu = rawAny.pNeu;
    } else {
      const conf = rawResult.confidence;
      if (rawResult.label === 'positive') {
        pPos = conf;
        pNeg = Math.max(0, (conf - rawResult.sentiment) / 2);
        pNeu = Math.max(0, 1 - pPos - pNeg);
      } else if (rawResult.label === 'negative') {
        pNeg = conf;
        pPos = Math.max(0, (conf + rawResult.sentiment) / 2);
        pNeu = Math.max(0, 1 - pPos - pNeg);
      } else {
        pNeu = conf;
        const diff = Math.abs(rawResult.sentiment);
        pPos = Math.max(0, (1 - pNeu + rawResult.sentiment) / 2);
        pNeg = Math.max(0, (1 - pNeu - rawResult.sentiment) / 2);
      }
    }

    // Ensure baseline sum is non-zero
    let sum = pPos + pNeg + pNeu;
    if (sum <= 0) { pPos = 0.33; pNeg = 0.33; pNeu = 0.34; }
    else { pPos /= sum; pNeg /= sum; pNeu /= sum; }

    // --- RULE 1: Negative Financial Metric + Upward / Growth Verbs ---
    // Patterns like "default rate(s) climb/rise/surge/increase", "delinquencies rise", "losses widen/jump", "bankruptcy filings rise"
    const negMetricPattern = /(default rate|delinquency|delinquencies|bankruptcy|foreclosures|loan loss|charge-off|impairment|bad debt|debt default|deficit|insolvency)/i;
    const upwardPattern = /(climb|climbs|climbing|rise|rises|rising|surge|surges|surging|increase|increases|increasing|jump|jumps|jumping|expand|expands|expanding|soar|soars|widen|widens|widening)/i;
    const downwardPattern = /(fall|falls|falling|drop|drops|dropping|decline|declines|declining|decrease|decreases|decreasing|shrink|shrinks|narrow|narrows|narrowing|reduce|reduces|reducing)/i;

    if (negMetricPattern.test(textLower)) {
      if (upwardPattern.test(textLower)) {
        appliedRules.push('Negative Metric + Upward Verb Inversion');
        const shift = 0.45;
        pNeg += shift;
        pPos = Math.max(0.01, pPos - shift);
      } else if (downwardPattern.test(textLower) || textLower.includes('avoid') || textLower.includes('prevent')) {
        appliedRules.push('Negative Metric + Downward Verb / Avoidance Correction');
        const shift = 0.35;
        pPos += shift;
        pNeg = Math.max(0.01, pNeg - shift);
      }
    }

    // --- RULE 2: Macroeconomic Indicator Inversion & Context ---
    // Inflation, mortgage rates, borrowing interest rates
    const macroIndicatorPattern = /(inflation|cpi|consumer price index|producer price|mortgage rate|mortgage interest|borrowing cost|unemployment rate|unemployment claims)/i;

    if (macroIndicatorPattern.test(textLower)) {
      if (downwardPattern.test(textLower) || textLower.includes('cool') || textLower.includes('cools') || textLower.includes('moderated') || textLower.includes('slowed') || textLower.includes('eased')) {
        appliedRules.push('Macro Indicator Cooling (Positive Economic Signal)');
        const shift = 0.35;
        pPos += shift;
        pNeg = Math.max(0.01, pNeg - shift);
      } else if (upwardPattern.test(textLower) || textLower.includes('spike') || textLower.includes('accelerat')) {
        appliedRules.push('Macro Indicator Inflation/Rate Spike Signal');
        const shift = 0.35;
        pNeg += shift;
        pPos = Math.max(0.01, pPos - shift);
      }
    }

    // Rate Cut + Recession Panic Context
    if (textLower.includes('rate cut') || textLower.includes('cuts rate') || textLower.includes('lowers interest rate') || textLower.includes('lowers policy rate') || textLower.includes('cuts benchmark')) {
      if (textLower.includes('recession') || textLower.includes('slump') || textLower.includes('weakening') || textLower.includes('crisis') || textLower.includes('deteriorat')) {
        appliedRules.push('Rate Cut + Economic Weakness / Recession Signal');
        const shift = 0.35;
        pNeg += shift;
        pPos = Math.max(0.01, pPos - shift);
      }
    }

    // --- RULE 3: Positive Metric + Directional Movement ---
    const posMetricPattern = /(profit|revenue|earnings|margin|margins|guidance|free cash flow|net income|sales|dividend|upgrade|upgraded|credit rating upgraded)/i;

    if (posMetricPattern.test(textLower)) {
      if (downwardPattern.test(textLower) || textLower.includes('cut') || textLower.includes('cuts') || textLower.includes('compress') || textLower.includes('miss') || textLower.includes('downgrade')) {
        appliedRules.push('Positive Metric + Downward Action Correction');
        const shift = 0.35;
        pNeg += shift;
        pPos = Math.max(0.01, pPos - shift);
      } else if (upwardPattern.test(textLower) || textLower.includes('beat') || textLower.includes('raised') || textLower.includes('expand')) {
        appliedRules.push('Positive Metric + Upward Action Boost');
        const shift = 0.30;
        pPos += shift;
        pNeg = Math.max(0.01, pNeg - shift);
      }
    }

    // Regulatory Fines & Penalties
    if ((textLower.includes('fine') || textLower.includes('fined') || textLower.includes('penalty') || textLower.includes('sanction') || textLower.includes('lawsuit') || textLower.includes('imposes a')) && (textLower.includes('regulator') || textLower.includes('sec') || textLower.includes('fcc') || textLower.includes('fines'))) {
      appliedRules.push('Regulatory Fine / Enforcement Action');
      const shift = 0.40;
      pNeg += shift;
      pPos = Math.max(0.01, pPos - shift);
    }

    // --- RULE 4: Mixed Sentiment Contrast Resolution ---
    // Phrases like "revenue rose 12%, but margins fell" or "shares fall despite strong earnings"
    if (textLower.includes('despite') || textLower.includes(' warned') || textLower.includes(' but ') || textLower.includes('however')) {
      appliedRules.push('Mixed Sentiment Contrast Adjustment');
      if (textLower.includes('shares fall') || textLower.includes('stock fell') || textLower.includes('margin fell') || textLower.includes('margins fell') || textLower.includes('profit fell') || textLower.includes('guidance cut') || textLower.includes('warned of')) {
        pNeg += 0.25;
      }
    }

    // --- RULE 5: Calibrated Neutral Decision Boundary ---
    // Scheduled policy notices, auctions, releases, unchanged rates
    if (textLower.includes('unchanged') || textLower.includes('scheduled to release') || textLower.includes('publishes monthly') || textLower.includes('weekly auctions') || textLower.includes('statutory disclosure') || textLower.includes('leaves rate')) {
      appliedRules.push('Calibrated Neutral Policy / Schedule Notice');
      pNeu += 0.40;
    }

    // Normalize probabilities
    const newSum = pPos + pNeg + pNeu;
    if (newSum > 0) {
      pPos /= newSum;
      pNeg /= newSum;
      pNeu /= newSum;
    }

    // Calculate final adjusted metrics
    const adjustedSentiment = Number((pPos - pNeg).toFixed(4));
    let maxProb = Math.max(pPos, pNeg, pNeu);

    let adjustedLabel: 'positive' | 'neutral' | 'negative' = 'neutral';

    // Neutral Zone Calibration
    // If net sentiment gap between pos and neg is tiny (|pPos - pNeg| <= 0.15) and neutral is substantial, default to neutral
    if (Math.abs(pPos - pNeg) <= 0.15 && pNeu >= 0.32) {
      adjustedLabel = 'neutral';
      maxProb = pNeu;
    } else if (pPos > pNeg && pPos >= pNeu) {
      adjustedLabel = 'positive';
      maxProb = pPos;
    } else if (pNeg > pPos && pNeg >= pNeu) {
      adjustedLabel = 'negative';
      maxProb = pNeg;
    } else {
      adjustedLabel = 'neutral';
      maxProb = pNeu;
    }

    const adjustedConfidence = Number(maxProb.toFixed(4));

    return {
      rawFinBert: {
        sentiment: rawResult.sentiment,
        confidence: rawResult.confidence,
        label: rawResult.label
      },
      adjustedSentiment,
      adjustedConfidence,
      adjustedLabel,
      appliedRules,
      adjustedProbabilities: {
        pPos: Number(pPos.toFixed(4)),
        pNeg: Number(pNeg.toFixed(4)),
        pNeu: Number(pNeu.toFixed(4))
      }
    };
  }
}

export const financialContextLayer = new FinancialContextLayer();
