import { env, pipeline } from "@huggingface/transformers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pipe: any = null;
let _currentModel: string | null = null;

export interface EmbeddingsConfig {
  modelsBasePath: string;
  allowRemoteModels: boolean;
  embeddingModel: "minilm" | "bge-small" | "gte-small";
}

// Model configurations
const MODEL_MAP = {
  "minilm": "Xenova/all-MiniLM-L6-v2",
  "bge-small": "Xenova/bge-small-en-v1.5",
  "gte-small": "Xenova/gte-small"
} as const;

function normalizeBasePath(p: string): string {
  const v = p.trim();
  if (!v) return "./models";
  return v.replace(/\/+$/, "");
}

export async function loadEmbeddingsPipeline(cfg: EmbeddingsConfig): Promise<typeof _pipe> {
  const modelId = MODEL_MAP[cfg.embeddingModel] || MODEL_MAP["bge-small"];
  
  // Return cached pipeline if same model
  if (_pipe && _currentModel === modelId) return _pipe;
  
  // Clear cache if switching models
  if (_pipe && _currentModel !== modelId) {
    _pipe = null;
  }

  // When allowRemoteModels is true, disable local models to avoid 404 errors
  env.allowLocalModels = !cfg.allowRemoteModels;
  env.allowRemoteModels = cfg.allowRemoteModels;
  
  if (!cfg.allowRemoteModels) {
    env.localModelPath = normalizeBasePath(cfg.modelsBasePath);
  }

  console.log(`[Embeddings] Loading model: ${modelId}`);
  const startTime = performance.now();
  
  _pipe = await pipeline("feature-extraction", modelId, {
    dtype: "fp32",
    progress_callback: (progress: { status: string; progress?: number }) => {
      if (progress.progress !== undefined) {
        console.log(`[Embeddings] ${progress.status}: ${Math.round(progress.progress)}%`);
      }
    }
  });
  
  _currentModel = modelId;
  console.log(`[Embeddings] Model loaded in ${Math.round(performance.now() - startTime)}ms`);
  
  return _pipe;
}

export async function embedText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pipe: any,
  text: string
): Promise<Float32Array> {
  // Mean pooling over token embeddings.
  const out = await pipe(text, { pooling: "mean", normalize: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (out as any).data as Float32Array;
  return data;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error(`cosine dims mismatch: ${a.length} vs ${b.length}`);
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export function getModelInfo(model: EmbeddingsConfig["embeddingModel"]): { name: string; size: string; quality: string } {
  const info = {
    "minilm": { name: "MiniLM-L6-v2", size: "~23MB", quality: "Good" },
    "bge-small": { name: "BGE-Small-EN", size: "~130MB", quality: "Excellent" },
    "gte-small": { name: "GTE-Small", size: "~67MB", quality: "Very Good" }
  };
  return info[model] || info["bge-small"];
}
