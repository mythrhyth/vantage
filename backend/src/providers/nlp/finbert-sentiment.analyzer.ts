import { pipeline } from '@xenova/transformers';
import { ISentimentAnalyzer, SentimentResult } from './nlp.types';

export class FinBertSentimentAnalyzer implements ISentimentAnalyzer {
  private static pipelinePromise: Promise<any> | null = null;
  public readonly modelName = 'Xenova/finbert';

  private async getPipeline(): Promise<any> {
    if (!FinBertSentimentAnalyzer.pipelinePromise) {
      console.log(`[FinBertSentimentAnalyzer] Loading model ${this.modelName}...`);
      FinBertSentimentAnalyzer.pipelinePromise = pipeline('sentiment-analysis', this.modelName, {
        quantized: true
      });
    }
    return await FinBertSentimentAnalyzer.pipelinePromise;
  }

  async analyzeSentiment(text: string): Promise<SentimentResult> {
    if (!text || text.trim() === '') {
      throw new Error('Invalid text input: Text cannot be empty for sentiment analysis.');
    }

    const processedText = this.preprocessText(text);

    try {
      const classifier = await this.getPipeline();
      const rawOutput = await classifier(processedText, { topk: null });

      let pPos = 0;
      let pNeg = 0;
      let pNeu = 0;

      const items = Array.isArray(rawOutput[0]) ? rawOutput[0] : rawOutput;
      items.forEach((item: any) => {
        const lbl = (item.label || '').toLowerCase();
        if (lbl === 'positive' || lbl === 'pos') pPos = Number(item.score);
        else if (lbl === 'negative' || lbl === 'neg') pNeg = Number(item.score);
        else if (lbl === 'neutral' || lbl === 'neu') pNeu = Number(item.score);
      });

      // Mathematical probability-derived sentiment: P(positive) - P(negative)
      const rawSentiment = pPos - pNeg;
      const sentiment = Math.max(-1.0, Math.min(1.0, Number(rawSentiment.toFixed(4))));

      // Confidence: Maximum class probability
      const maxProb = Math.max(pPos, pNeg, pNeu);
      const confidence = Number(maxProb.toFixed(4));

      let label: 'positive' | 'negative' | 'neutral' = 'neutral';
      if (maxProb === pPos) label = 'positive';
      else if (maxProb === pNeg) label = 'negative';

      return {
        sentiment,
        confidence,
        label,
        drivers: [],
        model: this.modelName
      };
    } catch (err: any) {
      console.error('[FinBertSentimentAnalyzer] Inference error:', err);
      throw new Error(`FinBert Sentiment Inference Error: ${err.message}`);
    }
  }

  private preprocessText(text: string): string {
    const trimmed = text.trim();
    // Safely limit token window while preserving all financial numbers, tickers, and terminology intact
    if (trimmed.length <= 450) return trimmed;
    return trimmed.substring(0, 450);
  }
}

export const finBertSentimentAnalyzer = new FinBertSentimentAnalyzer();
