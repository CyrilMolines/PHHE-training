import { env, pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

let _pipe: FeatureExtractionPipeline | null = null;

export interface EmbeddingsConfig {
  modelsBasePath: string; // e.g. "./models"
  allowRemoteModels: boolean;
}

function normalizeBasePath(p: string): string {
  const v = p.trim();
  if (!v) return "./models";
  return v.replace(/\/+$/, "");
}

export async function loadEmbeddingsPipeline(cfg: EmbeddingsConfig): Promise<FeatureExtractionPipeline> {
  if (_pipe) return _pipe;

  env.allowLocalModels = true;
  env.allowRemoteModels = cfg.allowRemoteModels;
  env.localModelPath = normalizeBasePath(cfg.modelsBasePath);

  // Model must be present under `${modelsBasePath}/all-MiniLM-L6-v2/` when remote models are disabled.
  _pipe = (await pipeline("feature-extraction", "all-MiniLM-L6-v2", {
    quantized: true
  })) as FeatureExtractionPipeline;
  return _pipe;
}

export async function embedText(
  pipe: FeatureExtractionPipeline,
  text: string
): Promise<Float32Array> {
  // Mean pooling over token embeddings.
  const out = await pipe(text, { pooling: "mean", normalize: true });
  // transformers.js returns a TypedArray-like structure; `.data` is Float32Array.
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

