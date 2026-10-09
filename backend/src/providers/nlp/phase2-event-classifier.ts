import fs from 'fs';
import path from 'path';
import { env, pipeline } from '@xenova/transformers';

export interface Phase2ModelLocation {
  parentDir: string;
  modelFolder: string;
  fullPath: string;
}

export interface EventClassificationResult {
  predictedCategory: string;
  confidence: number;
  top2Category: string;
  top2Confidence: number;
  categoryProbabilities: Record<string, number>;
  model: string;
}

export interface IEventClassifier {
  classifyEvent(text: string): Promise<EventClassificationResult>;
}

export function resolvePhase2EventClassifierModelPath(): Phase2ModelLocation {
  const customPath = process.env.PHASE2_EVENT_MODEL_PATH;

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
        `[Phase2EventClassifier] Configured PHASE2_EVENT_MODEL_PATH "${trimmed}" was not found or is missing ONNX artifacts (expected config.json and onnx/model.onnx at ${validCustom}).`
      );
    }
  }

  // Standard candidates when PHASE2_EVENT_MODEL_PATH is not specified
  const candidates = [
    path.resolve(process.cwd(), 'models/nlp/phase2-event-classifier'),
    path.resolve(process.cwd(), 'backend/models/nlp/phase2-event-classifier'),
    path.resolve(__dirname, '../../../models/nlp/phase2-event-classifier'),
    path.resolve(__dirname, '../../../../models/nlp/phase2-event-classifier')
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
    `[Phase2EventClassifier] Local Phase 2 Event Classifier model not found! ` +
    `Searched candidates:\n  - ${candidates.join('\n  - ')}\n` +
    `Ensure the fine-tuned Phase 2 ONNX model artifact exists at backend/models/nlp/phase2-event-classifier/ with config.json and onnx/model.onnx.`
  );
}

export const VALID_EVENT_CATEGORIES = [
  'Monetary policy',
  'Credit',
  'Commodities',
  'Earnings',
  'Sector outlook',
  'Geopolitical',
  'Regulatory',
  'Macroeconomic'
] as const;

export class Phase2EventClassifier implements IEventClassifier {
  private static pipelinePromise: Promise<any> | null = null;
  private static loadedModelPath: string | null = null;
  public readonly modelName = 'phase2-event-classifier';

  /**
   * Resets the cached pipeline instance (primarily used for unit testing path resolution / reloading).
   */
  public static resetPipelineCache() {
    Phase2EventClassifier.pipelinePromise = null;
    Phase2EventClassifier.loadedModelPath = null;
  }

  /**
   * Gets the currently loaded model path or null.
   */
  public static getLoadedModelPath(): string | null {
    return Phase2EventClassifier.loadedModelPath;
  }

  private async getPipeline(): Promise<any> {
    if (!Phase2EventClassifier.pipelinePromise) {
      const location = resolvePhase2EventClassifierModelPath();
      console.log(`[Phase2EventClassifier] Loading fine-tuned Phase 2 Event Classifier local model from ${location.fullPath}...`);

      // Strictly enforce local model loading — NO remote downloads or HuggingFace fallback
      env.allowRemoteModels = false;
      env.allowLocalModels = true;
      env.localModelPath = location.parentDir;

      Phase2EventClassifier.pipelinePromise = pipeline('text-classification', location.modelFolder, {
        quantized: false,
        local_files_only: true
      });
      Phase2EventClassifier.loadedModelPath = location.fullPath;
    }
    return await Phase2EventClassifier.pipelinePromise;
  }

  async classifyEvent(text: string): Promise<EventClassificationResult> {
    if (!text || text.trim() === '') {
      throw new Error('Invalid text input: Text cannot be empty for event classification.');
    }

    const trimmed = text.trim();
    // For long texts, slice to first 1500 chars (headline + lead paragraph contain primary event classification signals)
    const inputText = trimmed.length > 1500 ? trimmed.substring(0, 1500) : trimmed;

    try {
      const classifier = await this.getPipeline();
      const rawOutput = await classifier(inputText, { topk: null });

      const items = Array.isArray(rawOutput[0]) ? rawOutput[0] : rawOutput;
      
      const categoryProbabilities: Record<string, number> = {};
      VALID_EVENT_CATEGORIES.forEach(cat => {
        categoryProbabilities[cat] = 0;
      });

      items.forEach((item: any) => {
        const labelStr = item.label;
        const score = Number(item.score);
        if (labelStr in categoryProbabilities) {
          categoryProbabilities[labelStr] = score;
        } else {
          // If label string is a numeric string "0", "1", etc.
          const idx = parseInt(labelStr, 10);
          if (!isNaN(idx) && idx >= 0 && idx < VALID_EVENT_CATEGORIES.length) {
            categoryProbabilities[VALID_EVENT_CATEGORIES[idx]] = score;
          }
        }
      });

      // Sort categories by probability descending
      const sorted = Object.entries(categoryProbabilities)
        .map(([category, prob]) => ({ category, prob }))
        .sort((a, b) => b.prob - a.prob);

      const top1Category = sorted[0].category;
      const top1Confidence = Number(sorted[0].prob.toFixed(6));

      const top2Category = sorted[1].category;
      const top2Confidence = Number(sorted[1].prob.toFixed(6));

      return {
        predictedCategory: top1Category,
        confidence: top1Confidence,
        top2Category: top2Category,
        top2Confidence: top2Confidence,
        categoryProbabilities,
        model: this.modelName
      };
    } catch (err: any) {
      console.error('[Phase2EventClassifier] Inference error:', err);
      throw new Error(`Phase2 Event Classifier Inference Error: ${err.message}`);
    }
  }
}

export const phase2EventClassifier = new Phase2EventClassifier();
