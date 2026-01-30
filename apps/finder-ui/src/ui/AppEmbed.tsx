import { useEffect, useMemo, useState } from "preact/hooks";
import type { RankedTraining, TrainingRecord } from "../lib/schema";
import { loadDemoTrainings } from "../lib/demo";
import { buildLexicalIndex, applyStructuredFilters, rankLexical, type LexicalIndex } from "../lib/search";
import { loadCachedTrainings, saveCachedTrainings, loadEmbedding, saveEmbedding } from "../lib/cache";
import { type ExtractedIntent } from "../lib/chatModel";


// ============ CONFIGURATION ============
// URL parameters:
//   ?mode=sharepoint&site=/sites/YourSite&list=YourListName  (use SharePoint)
//   ?mode=demo  (use demo JSON - default for standalone)
// Auto-detects SharePoint environment when embedded on *.sharepoint.com

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    site: params.get("site"),
    list: params.get("list"),
    mode: params.get("mode") // "demo" or "sharepoint"
  };
}

function detectDataSource(): "demo_json" | "sharepoint" {
  const params = getUrlParams();
  
  // Explicit mode parameter takes priority
  if (params.mode === "sharepoint") return "sharepoint";
  if (params.mode === "demo") return "demo_json";
  
  // Auto-detect: if on SharePoint domain, use SharePoint
  if (window.location.hostname.includes("sharepoint.com")) {
    return "sharepoint";
  }
  
  // Default: demo JSON for standalone/GitHub Pages
  return "demo_json";
}

const URL_PARAMS = getUrlParams();

const CONFIG = {
  // Data source: auto-detected or from URL params
  dataSource: detectDataSource(),
  
  // SharePoint settings - URL params override defaults
  sharepoint: {
    siteRelativeUrl: URL_PARAMS.site || "/sites/EuroWCPHE",
    listTitle: URL_PARAMS.list || "Copytraininglist2912026"
  },
  
  // Search mode: "fast" (instant lexical) or "semantic" (slower but smarter)
  searchMode: "fast" as "fast" | "semantic",
  
  // AI Models (only used if searchMode is "semantic")
  embeddingModel: "bge-small" as const,
  allowRemoteModels: true,
  modelsBasePath: "./models"
};
// ===========================================================

type LoadingStage = "idle" | "data" | "embeddings" | "precompute" | "ready";

export function AppEmbed() {
  const [records, setRecords] = useState<TrainingRecord[] | null>(null);
  const [index, setIndex] = useState<LexicalIndex | null>(null);
  
  // Loading state
  const [stage, setStage] = useState<LoadingStage>("idle");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing...");
  
  // Model readiness
  const [embeddingsReady, setEmbeddingsReady] = useState(false);
  
  const [input, setInput] = useState("");
  const [lastResults, setLastResults] = useState<RankedTraining[] | null>(null);
  const [lastIntent, setLastIntent] = useState<ExtractedIntent | null>(null);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  const isReady = useMemo(() => stage === "ready", [stage]);

  // Initialize everything on mount
  useEffect(() => {
    initializeApp();
  }, []);

  async function initializeApp() {
    // Stage 1: Load data (0-30%)
    setStage("data");
    setStatusText("Loading training data...");
    setProgress(5);
    
    try {
      const cached = await loadCachedTrainings();
      if (cached && cached.length) {
        setRecords(cached);
        setIndex(buildLexicalIndex(cached));
        setProgress(15);
      }

      const fresh = CONFIG.dataSource === "demo_json"
        ? await loadDemoTrainings()
        : await loadSharePointData();
      
      setRecords(fresh);
      setIndex(buildLexicalIndex(fresh));
      await saveCachedTrainings(fresh);
      setProgress(30);
      
    } catch (e) {
      console.error("Failed to load data:", e);
      setStatusText("Error loading data. Please refresh.");
      return;
    }

    // Stage 2: Load embeddings (only for semantic mode)
    if (CONFIG.searchMode === "semantic") {
      setStage("embeddings");
      setStatusText("Loading semantic search model...");
      
      try {
        const { loadEmbeddingsPipeline } = await import("../lib/embeddings");
        await loadEmbeddingsPipeline({
          modelsBasePath: CONFIG.modelsBasePath,
          allowRemoteModels: CONFIG.allowRemoteModels,
          embeddingModel: CONFIG.embeddingModel
        });
        setEmbeddingsReady(true);
        setProgress(100);
      } catch (e) {
        console.error("Failed to load embeddings:", e);
        setProgress(100);
      }
    } else {
      // Fast mode - skip embedding loading entirely
      setProgress(100);
    }

    // Ready!
    setStage("ready");
    setStatusText("");
  }

  async function loadSharePointData(): Promise<TrainingRecord[]> {
    const { fetchAllListItems } = await import("../lib/sharepoint");
    return fetchAllListItems({
      siteRelativeUrl: CONFIG.sharepoint.siteRelativeUrl,
      listTitle: CONFIG.sharepoint.listTitle
    });
  }

  async function runSearch(userText: string) {
    if (!records || !index) return;

    // Fast intent extraction (no AI model, instant)
    const intent = fallbackExtractIntent(userText);
    setLastIntent(intent);

    // Apply filters
    const filtered = applyStructuredFilters(records, {
      modality: intent.modality,
      language: intent.language,
      platform: intent.platform,
      audienceContains: intent.audience
    });

    // Rank results - lexical is instant, hybrid is slower but smarter
    let ranked: RankedTraining[];
    
    if (CONFIG.searchMode === "semantic" && embeddingsReady) {
      ranked = await rankHybrid(filtered, intent.topic, index);
    } else {
      // Fast mode: lexical search is instant
      ranked = rankLexical(filtered, intent.topic, index);
    }

    const top = ranked.slice(0, 10);
    setLastResults(top);
  }

  function fallbackExtractIntent(query: string): ExtractedIntent {
    const t = query.toLowerCase();
    let topic = query;
    
    const intent: ExtractedIntent = {
      topic: query,
      rawQuery: query
    };

    const languages = ["english", "french", "spanish", "russian", "arabic", "portuguese", "chinese", "ukrainian", "polish"];
    for (const lang of languages) {
      const langPattern = new RegExp(`\\b(in\\s+)?${lang}\\b`, "gi");
      if (langPattern.test(t)) {
        intent.language = lang.charAt(0).toUpperCase() + lang.slice(1);
        topic = topic.replace(langPattern, "");
        break;
      }
    }

    if (/\bonline\b|e-learning/i.test(t)) {
      intent.modality = "online";
      topic = topic.replace(/\bonline\b|e-learning/gi, "");
    } else if (/\bin[- ]person\b/i.test(t)) {
      intent.modality = "in_person";
      topic = topic.replace(/\bin[- ]person\b/gi, "");
    } else if (/\bblended\b/i.test(t)) {
      intent.modality = "blended";
      topic = topic.replace(/\bblended\b/gi, "");
    }

    if (/openwho/i.test(t)) {
      intent.platform = "OpenWHO";
      topic = topic.replace(/openwho/gi, "");
    } else if (/who academy/i.test(t)) {
      intent.platform = "WHO Academy";
      topic = topic.replace(/who academy/gi, "");
    } else if (/hslp/i.test(t)) {
      intent.platform = "HSLP";
      topic = topic.replace(/hslp/gi, "");
    }

    if (/member state|ministry/i.test(t)) intent.audience = "Member";
    else if (/who staff/i.test(t)) intent.audience = "WHO";

    topic = topic
      .replace(/\b(i need|i want|i'm looking for|looking for|find me|show me|a training|training|about|on|for)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    
    intent.topic = topic || "health emergency";
    return intent;
  }

  async function rankHybrid(
    filteredRecords: TrainingRecord[],
    query: string,
    idx: LexicalIndex
  ): Promise<RankedTraining[]> {
    const lexical = rankLexical(filteredRecords, query, idx);
    if (lexical.length === 0 || !embeddingsReady) return lexical;

    try {
      const { cosineSimilarity, embedText, loadEmbeddingsPipeline } = await import("../lib/embeddings");
      const pipe = await loadEmbeddingsPipeline({
        modelsBasePath: CONFIG.modelsBasePath,
        allowRemoteModels: CONFIG.allowRemoteModels,
        embeddingModel: CONFIG.embeddingModel
      });
      const qVec = await embedText(pipe, query);

      const top = lexical.slice(0, 50);
      for (const entry of top) {
        const id = entry.record.id;
        let vec = await loadEmbedding(id);
        if (!vec) {
          vec = await embedText(pipe, entry.record.searchText);
          await saveEmbedding(id, vec);
        }
        const sim = cosineSimilarity(qVec, vec);
        entry.score = entry.score + sim * 2.0;
        if (sim > 0.35) entry.reasons.push("semantic match");
      }

      top.sort((a, b) => b.score - a.score);
      return top;
    } catch {
      return lexical;
    }
  }

  async function onSend() {
    const text = input.trim();
    if (!text || !isReady) return;
    setInput("");
    await runSearch(text);
  }

  return (
    <div class="embed-container">
      {/* Loading overlay */}
      {stage !== "ready" && (
        <div class="loading-overlay">
          <div class="loading-content">
            <div class="loading-title">WHO PHHE Training Finder</div>
            <div class="loading-bar-container">
              <div class="loading-bar" style={{ width: `${progress}%` }} />
            </div>
            <div class="loading-text">{statusText}</div>
            <div class="loading-percent">{progress}%</div>
          </div>
        </div>
      )}

      {/* Main UI */}
      <div class={`embed-main ${stage !== "ready" ? "hidden" : ""}`}>
        <div class="embed-header">
          <div class="embed-header-text">
            <span class="embed-title">WHO PHHE Training Finder</span>
            <span class="embed-subtitle">WHO European Centre for Preparedness for Humanitarian and Health Emergencies (PHHE)</span>
          </div>
        </div>

        <div class="embed-chat">
          <div class="embed-composer">
            <input
              type="text"
              value={input}
              placeholder="Describe the training you need..."
              disabled={!isReady}
              onInput={(e) => setInput((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onSend();
              }}
            />
            <button class="embed-send" disabled={!isReady} onClick={() => void onSend()}>
              Search
            </button>
          </div>
        </div>

        {lastResults !== null && (
          <div class="embed-results">
            {lastIntent && (
              <div class="embed-filters">
                <strong>Topic:</strong> {lastIntent.topic}
                {lastIntent.language && <span class="filter-pill">{lastIntent.language}</span>}
                {lastIntent.modality && <span class="filter-pill">{lastIntent.modality}</span>}
                {lastIntent.platform && <span class="filter-pill">{lastIntent.platform}</span>}
              </div>
            )}
            
            {lastResults.length === 0 && (
              <div class="no-results">
                <div class="no-results-icon">🔍</div>
                <div class="no-results-text">No trainings found</div>
                <div class="no-results-hint">
                  Try different keywords or remove filters like language/modality
                </div>
              </div>
            )}
            
            {lastResults.map((r, i) => {
              const isExpanded = expandedCard === i;
              return (
                <div 
                  key={i} 
                  class={`embed-card ${isExpanded ? "expanded" : ""}`}
                  onClick={() => setExpandedCard(isExpanded ? null : i)}
                >
                  <div class="card-header">
                    <div class="card-title">{r.record.learningName}</div>
                    <span class="card-expand-icon">{isExpanded ? "▼" : "▶"}</span>
                  </div>
                  
                  {!isExpanded && (
                    <div class="card-desc">{r.record.description?.slice(0, 120)}{r.record.description && r.record.description.length > 120 ? "..." : ""}</div>
                  )}
                  
                  <div class="card-tags">
                    {r.record.technicalArea && <span class="tag">{r.record.technicalArea}</span>}
                    {r.record.modality && r.record.modality !== "unknown" && <span class="tag">{r.record.modality}</span>}
                    {r.record.platform && <span class="tag">{r.record.platform}</span>}
                    {r.record.languages.length > 0 && <span class="tag">{r.record.languages.slice(0, 3).join(", ")}</span>}
                  </div>
                  
                  {isExpanded && (
                    <div class="card-details">
                      {r.record.description && (
                        <div class="detail-row">
                          <span class="detail-label">Description</span>
                          <p class="detail-value">{r.record.description}</p>
                        </div>
                      )}
                      
                      {r.record.intendedAudience && (
                        <div class="detail-row">
                          <span class="detail-label">Target Audience</span>
                          <p class="detail-value">{r.record.intendedAudience}</p>
                        </div>
                      )}
                      
                      {r.record.focusArea && (
                        <div class="detail-row">
                          <span class="detail-label">Focus Area</span>
                          <p class="detail-value">{r.record.focusArea}</p>
                        </div>
                      )}
                      
                      {r.record.languages.length > 0 && (
                        <div class="detail-row">
                          <span class="detail-label">Languages</span>
                          <p class="detail-value">{r.record.languages.join(", ")}</p>
                        </div>
                      )}
                      
                      {r.record.owner && (
                        <div class="detail-row">
                          <span class="detail-label">Owner</span>
                          <p class="detail-value">{r.record.owner}</p>
                        </div>
                      )}
                      
                      {r.record.developer && (
                        <div class="detail-row">
                          <span class="detail-label">Developer</span>
                          <p class="detail-value">{r.record.developer}</p>
                        </div>
                      )}
                      
                      {r.record.contactDetails && (
                        <div class="detail-row">
                          <span class="detail-label">Contact</span>
                          <p class="detail-value">{r.record.contactDetails}</p>
                        </div>
                      )}
                      
                      {r.record.normalizedLink && (
                        <a 
                          class="card-link" 
                          href={r.record.normalizedLink} 
                          target="_blank" 
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open training
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
