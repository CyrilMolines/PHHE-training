import { openDB } from "idb";
import type { TrainingRecord } from "./schema";

type DBSchemaV1 = {
  trainings: {
    key: string;
    value: { updatedAt: number; records: TrainingRecord[] };
  };
  embeddings: {
    key: string; // record.id
    value: { dims: number; data: ArrayBuffer };
  };
};

const DB_NAME = "who-training-finder-db";
const DB_VERSION = 1;
const TRAININGS_KEY = "trainings";

export async function db(): Promise<ReturnType<typeof openDB<DBSchemaV1>>> {
  return openDB<DBSchemaV1>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("trainings")) db.createObjectStore("trainings");
      if (!db.objectStoreNames.contains("embeddings")) db.createObjectStore("embeddings");
    }
  });
}

export async function loadCachedTrainings(): Promise<TrainingRecord[] | null> {
  const d = await db();
  const entry = await d.get("trainings", TRAININGS_KEY);
  return entry?.records ?? null;
}

export async function saveCachedTrainings(records: TrainingRecord[]): Promise<void> {
  const d = await db();
  await d.put("trainings", { updatedAt: Date.now(), records }, TRAININGS_KEY);
}

export async function loadEmbedding(id: string): Promise<Float32Array | null> {
  const d = await db();
  const entry = await d.get("embeddings", id);
  if (!entry) return null;
  return new Float32Array(entry.data);
}

export async function saveEmbedding(id: string, vec: Float32Array): Promise<void> {
  const d = await db();
  // Copy into a standalone ArrayBuffer so it survives structured clone and has the right type.
  const view = new Uint8Array(vec.buffer, vec.byteOffset, vec.byteLength);
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  await d.put("embeddings", { dims: vec.length, data: copy.buffer }, id);
}

