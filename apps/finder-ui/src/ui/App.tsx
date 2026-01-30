import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { RankedTraining, TrainingRecord } from "../lib/schema";
import { loadConfig, saveConfig, type AppConfig, getModelSizes } from "../lib/config";
import { loadDemoTrainings } from "../lib/demo";
import { fetchAllListItems } from "../lib/sharepoint";
import { buildLexicalIndex, applyStructuredFilters, rankLexical, type LexicalIndex } from "../lib/search";
import { loadCachedTrainings, saveCachedTrainings, loadEmbedding, saveEmbedding } from "../lib/cache";
import { getModelInfo } from "../lib/embeddings";
import { getChatModelInfo, type ExtractedIntent, type TrainingSummary } from "../lib/chatModel";

type Msg = { role: "user" | "bot"; text: string; isLoading?: boolean };

type ModelStatus = "idle" | "loading" | "ready" | "error";

export function App() {
  const [cfg, setCfg] = useState<AppConfig>(() => loadConfig());
  const [records, setRecords] = useState<TrainingRecord[] | null>(null);
  const [index, setIndex] = useState<LexicalIndex | null>(null);
  const [loading, setLoading] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  
  // Model states
  const [embeddingStatus, setEmbeddingStatus] = useState<ModelStatus>("idle");
  const [chatStatus, setChatStatus] = useState<ModelStatus>("idle");
  const [modelProgress, setModelProgress] = useState<string>("");
  
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "bot",
      text: "Hello! I'm the WHO Training Finder AI. Tell me what kind of training you're looking for - describe the topic, your goals, preferred language, or format (online/in-person). I'll help you find the best matches."
    }
  ]);
  const [input, setInput] = useState("");
  const [lastResults, setLastResults] = useState<RankedTraining[] | null>(null);
  const [lastIntent, setLastIntent] = useState<ExtractedIntent | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, configOpen, lastResults]);

  const canSearch = useMemo(() => Boolean(records && index), [records, index]);

  async function loadData(useCacheFirst: boolean) {
    setLoading(true);
    try {
      if (useCacheFirst) {
        const cached = await loadCachedTrainings();
        if (cached && cached.length) {
          setRecords(cached);
          setIndex(buildLexicalIndex(cached));
        }
      }

      const fresh =
        cfg.dataSource === "demo_json"
          ? await loadDemoTrainings()
          : await fetchAllListItems({
              siteRelativeUrl: cfg.siteRelativeUrl,
              listTitle: cfg.listTitle
            });
      setRecords(fresh);
      setIndex(buildLexicalIndex(fresh));
      await saveCachedTrainings(fresh);
      
      setMessages((m) => [
        ...m,
        { role: "bot", text: `Loaded ${fresh.length} trainings. I'm ready to help you find what you need!` }
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "bot", text: `Could not load training data: ${String(e)}` }
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function loadModels() {
    if (cfg.enableEmbeddings && embeddingStatus === "idle") {
      setEmbeddingStatus("loading");
      setModelProgress("Loading embedding model...");
      try {
        const { loadEmbeddingsPipeline } = await import("../lib/embeddings");
        await loadEmbeddingsPipeline({
          modelsBasePath: cfg.modelsBasePath,
          allowRemoteModels: cfg.allowRemoteModels,
          embeddingModel: cfg.embeddingModel
        });
        setEmbeddingStatus("ready");
        setModelProgress("");
      } catch (e) {
        console.error("Failed to load embedding model:", e);
        setEmbeddingStatus("error");
        setModelProgress("Embedding model failed to load");
      }
    }

    if (cfg.enableChatModel && chatStatus === "idle") {
      setChatStatus("loading");
      setModelProgress("Loading AI assistant model...");
      try {
        const { loadChatModel } = await import("../lib/chatModel");
        await loadChatModel({
          modelsBasePath: cfg.modelsBasePath,
          allowRemoteModels: cfg.allowRemoteModels
        });
        setChatStatus("ready");
        setModelProgress("");
      } catch (e) {
        console.error("Failed to load chat model:", e);
        setChatStatus("error");
        setModelProgress("AI model failed to load");
      }
    }
  }

  useEffect(() => {
    loadData(true).catch(console.error);
  }, []);

  useEffect(() => {
    if (records && records.length > 0) {
      loadModels();
    }
  }, [records, cfg.enableEmbeddings, cfg.enableChatModel]);

  async function runSearch(userText: string) {
    if (!records || !index) return;

    // Add loading message
    const loadingMsgIdx = messages.length;
    setMessages((m) => [...m, { role: "bot", text: "Analyzing your request...", isLoading: true }]);

    let intent: ExtractedIntent;
    
    // Try to use chat model for intent extraction
    if (chatStatus === "ready") {
      try {
        const { extractIntent, loadChatModel } = await import("../lib/chatModel");
        const chatPipe = await loadChatModel({
          modelsBasePath: cfg.modelsBasePath,
          allowRemoteModels: cfg.allowRemoteModels
        });
        intent = await extractIntent(chatPipe, userText);
      } catch {
        intent = fallbackExtractIntent(userText);
      }
    } else {
      intent = fallbackExtractIntent(userText);
    }
    
    setLastIntent(intent);

    // Apply filters
    const filtered = applyStructuredFilters(records, {
      modality: intent.modality,
      language: intent.language,
      platform: intent.platform,
      audienceContains: intent.audience
    });

    // Rank results
    let ranked: RankedTraining[];
    
    if (embeddingStatus === "ready") {
      ranked = await rankHybrid(filtered, intent.topic, index);
    } else {
      ranked = rankLexical(filtered, intent.topic, index);
    }

    const top = ranked.slice(0, 12);
    setLastResults(top);

    // Generate response
    let responseText: string;
    
    if (chatStatus === "ready" && top.length > 0) {
      try {
        const { generateResponse, loadChatModel } = await import("../lib/chatModel");
        const chatPipe = await loadChatModel({
          modelsBasePath: cfg.modelsBasePath,
          allowRemoteModels: cfg.allowRemoteModels
        });
        
        const summaries: TrainingSummary[] = top.slice(0, 5).map(r => ({
          name: r.record.learningName,
          description: r.record.description,
          technicalArea: r.record.technicalArea,
          focusArea: r.record.focusArea,
          platform: r.record.platform,
          languages: r.record.languages,
          modality: r.record.modalityRaw
        }));
        
        responseText = await generateResponse(chatPipe, intent, summaries, ranked.length);
      } catch {
        responseText = generateFallbackResponse(intent, top, ranked.length);
      }
    } else {
      responseText = generateFallbackResponse(intent, top, ranked.length);
    }

    // Update message (replace loading message)
    setMessages((m) => {
      const updated = [...m];
      updated[loadingMsgIdx] = { role: "bot", text: responseText };
      return updated;
    });
  }

  function fallbackExtractIntent(query: string): ExtractedIntent {
    const t = query.toLowerCase();
    let topic = query;
    
    const intent: ExtractedIntent = {
      topic: query,
      rawQuery: query
    };

    // Extract and remove language from topic
    const languages = ["english", "french", "spanish", "russian", "arabic", "portuguese", "chinese", "ukrainian", "polish"];
    for (const lang of languages) {
      const langPattern = new RegExp(`\\b(in\\s+)?${lang}\\b`, "gi");
      if (langPattern.test(t)) {
        intent.language = lang.charAt(0).toUpperCase() + lang.slice(1);
        topic = topic.replace(langPattern, "");
        break;
      }
    }

    // Extract and remove modality from topic
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

    // Extract and remove platform from topic
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

    // Extract audience (don't remove from topic as it might be relevant)
    if (/member state|ministry/i.test(t)) intent.audience = "Member";
    else if (/who staff/i.test(t)) intent.audience = "WHO";

    // Clean up topic: remove filler words and extra whitespace
    topic = topic
      .replace(/\b(i need|i want|i'm looking for|looking for|find me|show me|a training|training|about|on|for)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    
    // If topic is empty after cleaning, use a generic search term
    intent.topic = topic || "health emergency";

    return intent;
  }

  function generateFallbackResponse(intent: ExtractedIntent, results: RankedTraining[], total: number): string {
    if (total === 0) {
      return `I couldn't find any trainings matching "${intent.topic}". Try broadening your search or removing filters.`;
    }
    
    const filters = [];
    if (intent.language) filters.push(`in ${intent.language}`);
    if (intent.modality) filters.push(intent.modality.replace("_", "-"));
    if (intent.platform) filters.push(`on ${intent.platform}`);
    
    const filterStr = filters.length ? ` (${filters.join(", ")})` : "";
    return `I found ${total} training(s) related to "${intent.topic}"${filterStr}. Here are the top ${Math.min(results.length, 12)} matches:`;
  }

  async function rankHybrid(
    filteredRecords: TrainingRecord[],
    query: string,
    idx: LexicalIndex
  ): Promise<RankedTraining[]> {
    const lexical = rankLexical(filteredRecords, query, idx);
    if (lexical.length === 0 || embeddingStatus !== "ready") return lexical;

    try {
      const { cosineSimilarity, embedText, loadEmbeddingsPipeline } = await import("../lib/embeddings");
      const pipe = await loadEmbeddingsPipeline({
        modelsBasePath: cfg.modelsBasePath,
        allowRemoteModels: cfg.allowRemoteModels,
        embeddingModel: cfg.embeddingModel
      });
      const qVec = await embedText(pipe, query);

      const top = lexical.slice(0, 60);
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
    if (!text) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    
    if (!canSearch) {
      setMessages((m) => [...m, { role: "bot", text: "Loading training data—please wait a moment..." }]);
      return;
    }
    await runSearch(text);
  }

  function onSaveConfig(next: AppConfig) {
    setCfg(next);
    saveConfig(next);
    setConfigOpen(false);
    
    // Reset model states if settings changed
    setEmbeddingStatus("idle");
    setChatStatus("idle");
    
    setMessages((m) => [
      ...m,
      { role: "bot", text: "Settings saved. Click 'Refresh' to apply changes." }
    ]);
  }

  const modelSizes = getModelSizes();
  const embeddingInfo = getModelInfo(cfg.embeddingModel);
  const chatInfo = getChatModelInfo();

  return (
    <div class="container">
      <div class="header">
        <div>
          <div class="title">WHO Training Finder</div>
          <div class="small">
            AI-powered training search • {records?.length || 0} trainings loaded
            {embeddingStatus === "ready" && " • Semantic search active"}
            {chatStatus === "ready" && " • AI assistant ready"}
          </div>
          {modelProgress && <div class="small progress">{modelProgress}</div>}
        </div>
        <div class="controls">
          <button class="primary" disabled={loading} onClick={() => loadData(false)}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button onClick={() => setConfigOpen((v) => !v)}>
            {configOpen ? "Close" : "Settings"}
          </button>
        </div>
      </div>

      <div class="model-status">
        <span class={`status-badge ${embeddingStatus}`}>
          Embeddings: {embeddingStatus === "ready" ? embeddingInfo.name : embeddingStatus}
        </span>
        <span class={`status-badge ${chatStatus}`}>
          AI: {chatStatus === "ready" ? "SmolLM" : chatStatus}
        </span>
      </div>

      <div class="grid">
        <div class="panel chat">
          <div class="messages">
            {messages.map((m, i) => (
              <div key={i} class={`message ${m.role} ${m.isLoading ? "loading" : ""}`}>
                {m.isLoading && <span class="spinner" />}
                {m.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div class="composer">
            <input
              type="text"
              value={input}
              placeholder="What training are you looking for?"
              onInput={(e) => setInput((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onSend();
              }}
            />
            <button class="primary" onClick={() => void onSend()}>
              Send
            </button>
          </div>
        </div>

        {configOpen && (
          <div class="panel config">
            <ConfigPanel cfg={cfg} onSave={onSaveConfig} modelSizes={modelSizes} />
          </div>
        )}

        {lastResults && lastResults.length > 0 && (
          <div class="panel results">
            {lastIntent && (
              <div class="intent-summary">
                <strong>Detected:</strong> {lastIntent.topic}
                {lastIntent.language && <span class="pill">{lastIntent.language}</span>}
                {lastIntent.modality && <span class="pill">{lastIntent.modality}</span>}
                {lastIntent.platform && <span class="pill">{lastIntent.platform}</span>}
              </div>
            )}
            {lastResults.map((r, i) => (
              <div key={i} class="card">
                <div class="cardTitle">{r.record.learningName}</div>
                <div class="small">{r.record.description}</div>
                <div class="pillRow">
                  {r.record.technicalArea && <span class="pill">{r.record.technicalArea}</span>}
                  {r.record.focusArea && <span class="pill">{r.record.focusArea}</span>}
                  {r.record.modality && r.record.modality !== "unknown" && (
                    <span class="pill">{r.record.modality}</span>
                  )}
                  {r.record.platform && <span class="pill">{r.record.platform}</span>}
                  {r.record.languages.length > 0 && (
                    <span class="pill">{r.record.languages.join(", ")}</span>
                  )}
                </div>
                {r.record.normalizedLink && (
                  <div class="small link">
                    <a href={r.record.normalizedLink} target="_blank" rel="noreferrer">
                      Open training →
                    </a>
                  </div>
                )}
                {r.reasons.length > 0 && <div class="small reasons">Match: {r.reasons.join(", ")}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigPanel(props: { 
  cfg: AppConfig; 
  onSave: (cfg: AppConfig) => void;
  modelSizes: { embeddings: string; chat: string; total: string };
}) {
  const [dataSource, setDataSource] = useState<AppConfig["dataSource"]>(props.cfg.dataSource);
  const [siteRelativeUrl, setSiteRelativeUrl] = useState(props.cfg.siteRelativeUrl);
  const [listTitle, setListTitle] = useState(props.cfg.listTitle);
  const [enableEmbeddings, setEnableEmbeddings] = useState(props.cfg.enableEmbeddings);
  const [embeddingModel, setEmbeddingModel] = useState<AppConfig["embeddingModel"]>(props.cfg.embeddingModel);
  const [enableChatModel, setEnableChatModel] = useState(props.cfg.enableChatModel);
  const [allowRemoteModels, setAllowRemoteModels] = useState(props.cfg.allowRemoteModels);

  return (
    <div class="configGrid">
      <h3>Data Source</h3>
      <label>
        Source type
        <select value={dataSource} onChange={(e) => setDataSource((e.target as HTMLSelectElement).value as AppConfig["dataSource"])}>
          <option value="demo_json">Demo data (standalone)</option>
          <option value="sharepoint">SharePoint list</option>
        </select>
      </label>

      {dataSource === "sharepoint" && (
        <>
          <label>
            Site URL (e.g., /sites/EuroWCPHE)
            <input type="text" value={siteRelativeUrl} onInput={(e) => setSiteRelativeUrl((e.target as HTMLInputElement).value)} />
          </label>
          <label>
            List title
            <input type="text" value={listTitle} onInput={(e) => setListTitle((e.target as HTMLInputElement).value)} />
          </label>
        </>
      )}

      <h3>AI Models</h3>
      
      <label>
        <input type="checkbox" checked={enableEmbeddings} onChange={(e) => setEnableEmbeddings((e.target as HTMLInputElement).checked)} />
        Enable semantic search (embeddings)
      </label>
      
      {enableEmbeddings && (
        <label>
          Embedding model
          <select value={embeddingModel} onChange={(e) => setEmbeddingModel((e.target as HTMLSelectElement).value as AppConfig["embeddingModel"])}>
            <option value="minilm">MiniLM-L6 (~23MB) - Fast</option>
            <option value="gte-small">GTE-Small (~67MB) - Balanced</option>
            <option value="bge-small">BGE-Small (~130MB) - Best quality</option>
          </select>
        </label>
      )}

      <label>
        <input type="checkbox" checked={enableChatModel} onChange={(e) => setEnableChatModel((e.target as HTMLInputElement).checked)} />
        Enable AI assistant (SmolLM ~270MB)
      </label>

      <label>
        <input type="checkbox" checked={allowRemoteModels} onChange={(e) => setAllowRemoteModels((e.target as HTMLInputElement).checked)} />
        Download models from HuggingFace
      </label>

      <div class="model-info">
        <strong>Estimated download:</strong> {props.modelSizes.total}
        <br />
        <small>Models are cached in browser after first load</small>
      </div>

      <div class="controls">
        <button
          class="primary"
          onClick={() =>
            props.onSave({
              ...props.cfg,
              dataSource,
              siteRelativeUrl: siteRelativeUrl.trim(),
              listTitle: listTitle.trim(),
              enableEmbeddings,
              embeddingModel,
              enableChatModel,
              allowRemoteModels
            })
          }
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
