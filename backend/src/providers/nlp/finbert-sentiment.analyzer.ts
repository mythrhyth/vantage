import fs from 'fs';
import path from 'path';
import { env, pipeline } from '@xenova/transformers';
import { ISentimentAnalyzer, SentimentResult } from './nlp.types';

export interface FinBertModelLocation {
  parentDir: string;
  modelFolder: string;
  fullPath: string;
}

export function resolveFinBertModelPath(): FinBertModelLocation {
  const customPath = process.env.FINBERT_MODEL_PATH;
  
  if (customPath && customPath.trim() !== '') {
    const trimmed = customPath.trim();
    const resolvedCustom = path.isAbsolute(trimmed) 
      ? trimmed 
      : path.resolve(process.cwd(), trimmed);

    const altResolved = (!path.isAbsolute(trimmed) && (trimmed.startsWith('backend/') || trimmed.startsWith('backend\\')))
      ? path.resolve(process.cwd(), trimmed.replace(/^backend[\/\\]/, ''))
      : resolvedCustom;

    const validCustom = fs.existsSync(path.join(resolvedCustom, 'config.json')) ? resolvedCustom : altResolved;
    const modelFile = path.join(validCustom, 'onnx', 'model.onnx');
    const configFile = path.join(validCustom, 'config.json');

    if (fs.existsSync(validCustom) && fs.existsSync(configFile) && fs.existsSync(modelFile)) {
      return {
        parentDir: path.dirname(validCustom),
        modelFolder: path.basename(validCustom),
        fullPath: validCustom
      };
    } else {
      throw new Error(
        `[FinBertSentimentAnalyzer] Configured FINBERT_MODEL_PATH "${trimmed}" was not found or is missing ONNX artifacts (expected config.json and onnx/model.onnx at ${validCustom}).`
      );
    }
  }

  // Standard candidates when FINBERT_MODEL_PATH is not specified
  const candidates = [
    path.resolve(process.cwd(), 'models/nlp/phase1d-finbert'),
    path.resolve(process.cwd(), 'backend/models/nlp/phase1d-finbert'),
    path.resolve(__dirname, '../../../models/nlp/phase1d-finbert'),
    path.resolve(__dirname, '../../../../models/nlp/phase1d-finbert')
  ];

  for (const candidate of candidates) {
    const modelFile = path.join(candidate, 'onnx', 'model.onnx');
    const configFile = path.join(candidate, 'config.json');
    if (fs.existsSync(candidate) && fs.existsSync(configFile) && fs.existsSync(modelFile)) {
      const parentDir = path.dirname(candidate);
      const modelFolder = path.basename(candidate);
      return { parentDir, modelFolder, fullPath: candidate };
    }
  }

  throw new Error(
    `[FinBertSentimentAnalyzer] Local Phase 1D FinBERT model not found! ` +
    `Searched candidates:\n  - ${candidates.join('\n  - ')}\n` +
    `Ensure the fine-tuned Phase 1D ONNX model artifact exists at backend/models/nlp/phase1d-finbert/ with config.json and onnx/model.onnx.`
  );
}

export class FinBertSentimentAnalyzer implements ISentimentAnalyzer {
  private static pipelinePromise: Promise<any> | null = null;
  private static loadedModelPath: string | null = null;
  public readonly modelName = 'phase1d-finbert';

  /**
   * Resets the cached pipeline instance (primarily used for unit testing path resolution / reloading).
   */
  public static resetPipelineCache() {
    FinBertSentimentAnalyzer.pipelinePromise = null;
    FinBertSentimentAnalyzer.loadedModelPath = null;
  }

  /**
   * Gets the currently loaded model path or null.
   */
  public static getLoadedModelPath(): string | null {
    return FinBertSentimentAnalyzer.loadedModelPath;
  }

  private async getPipeline(): Promise<any> {
    if (!FinBertSentimentAnalyzer.pipelinePromise) {
      const location = resolveFinBertModelPath();
      console.log(`[FinBertSentimentAnalyzer] Loading fine-tuned Phase 1D local model from ${location.fullPath}...`);

      // Strictly enforce local model loading — NO remote downloads or HuggingFace fallback
      env.allowRemoteModels = false;
      env.allowLocalModels = true;
      env.localModelPath = location.parentDir;

      FinBertSentimentAnalyzer.pipelinePromise = pipeline('sentiment-analysis', location.modelFolder, {
        quantized: false,
        local_files_only: true
      });
      FinBertSentimentAnalyzer.loadedModelPath = location.fullPath;
    }
    return await FinBertSentimentAnalyzer.pipelinePromise;
  }

  async analyzeSentiment(text: string): Promise<SentimentResult> {
    if (!text || text.trim() === '') {
      throw new Error('Invalid text input: Text cannot be empty for sentiment analysis.');
    }

    const trimmed = text.trim();
    const chunks = this.chunkText(trimmed);

    try {
      const classifier = await this.getPipeline();
      const chunkResults: Array<{ pos: number; neg: number; neu: number }> = [];

      for (const chunk of chunks) {
        const rawOutput = await classifier(chunk, { topk: null });
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

        chunkResults.push({ pos: pPos, neg: pNeg, neu: pNeu });
      }

      // Aggregate chunk probabilities deterministically
      const { pPos, pNeg, pNeu } = this.aggregateChunkProbabilities(chunkResults);

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
        model: this.modelName,
        pPos: Number(pPos.toFixed(4)),
        pNeg: Number(pNeg.toFixed(4)),
        pNeu: Number(pNeu.toFixed(4))
      };
    } catch (err: any) {
      console.error('[FinBertSentimentAnalyzer] Inference error:', err);
      throw new Error(`FinBert Sentiment Inference Error: ${err.message}`);
    }
  }

  /**
   * Deterministic long-article chunking strategy.
   * Preserves sentence boundaries and groups text into ~250 word / ~1200 char chunks.
   * Headline/lead chunk comes first. Maximum 5 chunks (~1,250 words) to control latency.
   */
  private chunkText(text: string): string[] {
    if (text.length <= 1500) {
      return [text];
    }

    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sentences.length <= 1) {
      const words = text.split(/\s+/);
      const chunks: string[] = [];
      const chunkSize = 250;
      for (let i = 0; i < words.length && chunks.length < 5; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '));
      }
      return chunks.length > 0 ? chunks : [text];
    }

    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLen = 0;

    for (const sentence of sentences) {
      if (currentLen + sentence.length > 1200 && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        currentChunk = [];
        currentLen = 0;
        if (chunks.length >= 5) break;
      }
      currentChunk.push(sentence);
      currentLen += sentence.length + 1;
    }

    if (currentChunk.length > 0 && chunks.length < 5) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks.length > 0 ? chunks : [text];
  }

  /**
   * Deterministically aggregate probabilities across chunks:
   * Chunk 0 (Headline/Lead) receives 50% weight.
   * Body chunks receive remaining 50% weight equally distributed.
   */
  private aggregateChunkProbabilities(
    results: Array<{ pos: number; neg: number; neu: number }>
  ): { pPos: number; pNeg: number; pNeu: number } {
    if (results.length === 1) {
      return { pPos: results[0].pos, pNeg: results[0].neg, pNeu: results[0].neu };
    }

    let weightedPos = 0;
    let weightedNeg = 0;
    let weightedNeu = 0;

    const leadWeight = 0.5;
    const bodyWeightTotal = 0.5;
    const bodyChunkWeight = bodyWeightTotal / (results.length - 1);

    results.forEach((r, idx) => {
      const weight = idx === 0 ? leadWeight : bodyChunkWeight;
      weightedPos += r.pos * weight;
      weightedNeg += r.neg * weight;
      weightedNeu += r.neu * weight;
    });

    const total = weightedPos + weightedNeg + weightedNeu;
    if (total > 0) {
      weightedPos /= total;
      weightedNeg /= total;
      weightedNeu /= total;
    }

    return { pPos: weightedPos, pNeg: weightedNeg, pNeu: weightedNeu };
  }
}

export const finBertSentimentAnalyzer = new FinBertSentimentAnalyzer();
