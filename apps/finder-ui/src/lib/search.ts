import type { RankedTraining, TrainingRecord } from "./schema";

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

// Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Check if two words are similar (fuzzy match)
function isFuzzyMatch(query: string, target: string, maxDistance = 2): boolean {
  // Exact match
  if (query === target) return true;
  
  // Prefix match (typing incomplete word)
  if (target.startsWith(query) && query.length >= 3) return true;
  
  // Contains match for longer queries
  if (query.length >= 4 && target.includes(query)) return true;
  
  // Levenshtein distance for typos
  if (query.length >= 4) {
    const distance = levenshtein(query, target);
    const threshold = Math.min(maxDistance, Math.floor(query.length / 3));
    if (distance <= threshold) return true;
  }
  
  // Stem comparison (remove common suffixes)
  const stemA = stemWord(query);
  const stemB = stemWord(target);
  if (stemA.length >= 4 && stemA === stemB) return true;
  
  return false;
}

// Simple stemming - remove common suffixes
function stemWord(word: string): string {
  return word
    .replace(/(ing|ed|tion|ment|ness|ity|ies|es|s)$/, "")
    .replace(/(.)\1+$/, "$1"); // remove repeated chars at end
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

export function bm25Score(index: LexicalIndex, query: string, useFuzzy = true): Map<string, number> {
  // Standard BM25 with fuzzy matching
  const k1 = 1.2;
  const b = 0.75;
  const qTerms = tokenize(query);
  const scores = new Map<string, number>();

  for (const doc of index.docs) {
    let score = 0;
    
    for (const qTerm of qTerms) {
      // First try exact match
      let f = doc.tf.get(qTerm) ?? 0;
      let matchType = "exact";
      
      // If no exact match and fuzzy is enabled, try fuzzy matching
      if (f === 0 && useFuzzy) {
        for (const [docTerm, count] of doc.tf.entries()) {
          if (isFuzzyMatch(qTerm, docTerm)) {
            f = count;
            matchType = "fuzzy";
            break;
          }
        }
      }
      
      if (!f) continue;
      
      const n_t = index.df.get(qTerm) ?? 1;
      const idf = Math.log(1 + (index.n - n_t + 0.5) / (n_t + 0.5));
      const denom = f + k1 * (1 - b + (b * doc.len) / (index.avgLen || 1));
      let termScore = idf * ((f * (k1 + 1)) / denom);
      
      // Slightly reduce score for fuzzy matches
      if (matchType === "fuzzy") termScore *= 0.8;
      
      score += termScore;
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

