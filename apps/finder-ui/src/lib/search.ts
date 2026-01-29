import type { RankedTraining, TrainingRecord } from "./schema";

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

type DocIndex = {
  record: TrainingRecord;
  tf: Map<string, number>;
  len: number;
};

export type LexicalIndex = {
  docs: DocIndex[];
  df: Map<string, number>;
  avgLen: number;
  n: number;
};

export function buildLexicalIndex(records: TrainingRecord[]): LexicalIndex {
  const df = new Map<string, number>();
  const docs: DocIndex[] = [];
  let totalLen = 0;

  for (const r of records) {
    const terms = tokenize(r.searchText);
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    const len = terms.length;
    totalLen += len;
    docs.push({ record: r, tf, len });
  }

  return { docs, df, avgLen: docs.length ? totalLen / docs.length : 0, n: docs.length };
}

export function bm25Score(index: LexicalIndex, query: string): Map<string, number> {
  // Standard BM25
  const k1 = 1.2;
  const b = 0.75;
  const qTerms = tokenize(query);
  const scores = new Map<string, number>();

  for (const doc of index.docs) {
    let score = 0;
    for (const t of qTerms) {
      const f = doc.tf.get(t) ?? 0;
      if (!f) continue;
      const n_t = index.df.get(t) ?? 0;
      const idf = Math.log(1 + (index.n - n_t + 0.5) / (n_t + 0.5));
      const denom = f + k1 * (1 - b + (b * doc.len) / (index.avgLen || 1));
      score += idf * ((f * (k1 + 1)) / denom);
    }
    if (score > 0) scores.set(doc.record.id, score);
  }

  return scores;
}

export function applyStructuredFilters(
  records: TrainingRecord[],
  filters: {
    modality?: string;
    language?: string;
    platform?: string;
    audienceContains?: string;
  }
): TrainingRecord[] {
  return records.filter((r) => {
    if (filters.modality && r.modality !== filters.modality) return false;
    if (filters.language) {
      const wanted = filters.language.toLowerCase();
      if (!r.languages.some((l) => l.toLowerCase() === wanted)) return false;
    }
    if (filters.platform) {
      const p = filters.platform.toLowerCase();
      if (!r.platform.toLowerCase().includes(p)) return false;
    }
    if (filters.audienceContains) {
      const a = filters.audienceContains.toLowerCase();
      if (!r.intendedAudience.toLowerCase().includes(a)) return false;
    }
    return true;
  });
}

export function rankLexical(
  records: TrainingRecord[],
  query: string,
  index: LexicalIndex
): RankedTraining[] {
  const scores = bm25Score(index, query);
  const ranked: RankedTraining[] = [];
  for (const r of records) {
    const s = scores.get(r.id) ?? 0;
    if (s <= 0) continue;
    const reasons: string[] = [];
    if (r.learningName.toLowerCase().includes(query.toLowerCase())) reasons.push("title match");
    ranked.push({ record: r, score: s, reasons });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

