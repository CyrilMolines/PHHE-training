import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { RankedTraining, TrainingRecord } from "../lib/schema";
import { loadConfig, saveConfig, type AppConfig } from "../lib/config";
import { loadDemoTrainings } from "../lib/demo";
import { fetchAllListItems } from "../lib/sharepoint";
import { buildLexicalIndex, applyStructuredFilters, rankLexical, type LexicalIndex } from "../lib/search";
import { loadCachedTrainings, saveCachedTrainings, loadEmbedding, saveEmbedding } from "../lib/cache";

type Msg = { role: "user" | "bot"; text: string };

type Intent = {
  query: string;
  modality?: string;
  language?: string;
  platform?: string;
  audienceContains?: string;
};

function extractIntentDelta(text: string): Partial<Intent> {
  const t = text.toLowerCase();
  const delta: Partial<Intent> = {};

  // Modality
  if (/\bonline\b/.test(t)) delta.modality = "online";
  if (/\bin[- ]person\b/.test(t)) delta.modality = "in_person";
  if (/\bblended\b/.test(t)) delta.modality = "blended";

  // Language (common in the dataset)
  const langMap: Array<[RegExp, string]> = [
    [/\benglish\b/, "English"],
    [/\bfrench\b/, "French"],
    [/\bspanish\b/, "Spanish"],
    [/\brussian\b/, "Russian"],
    [/\barabic\b/, "Arabic"],
    [/\bportuguese\b/, "Portuguese"],
    [/\bpolish\b/, "Polish"],
    [/\bukrainian\b/, "Ukrainian"],
    [/\bchinese\b/, "Chinese"],
    [/\bkiswahili\b/, "Kiswahili"],
    [/\bkirundi\b/, "Kirundi"]
  ];
  for (const [re, val] of langMap) {
    if (re.test(t)) {
      delta.language = val;
      break;
    }
  }

  // Platform (match by substring; not an enum)
  const platformHints: Array<[RegExp, string]> = [
    [/\bopenwho\b/, "OpenWHO"],
    [/\bwho academy\b/, "WHO Academy"],
    [/\bhslp\b/, "HSLP"],
    [/\bgoarn\b/, "GOARN"],
    [/\bvirtual campus\b/, "Virtual campus"]
  ];
  for (const [re, val] of platformHints) {
    if (re.test(t)) {
      delta.platform = val;
      break;
    }
  }

  // Audience heuristics
  if (/\bmember state(s)?\b/.test(t) || /\bministry of health\b/.test(t) || /\bmoh\b/.test(t)) {
    delta.audienceContains = "Member";
  }
  if (/\bwho staff\b/.test(t)) delta.audienceContains = "WHO";

  return delta;
}

function mergeIntent(prev: Intent, userText: string): Intent {
  const delta = extractIntentDelta(userText);
  const query = userText.trim();
  return {
    ...prev,
    ...delta,
    query: query || prev.query
  };
}

async function rankHybrid(
  records: TrainingRecord[],
  query: string,
  index: LexicalIndex,
  embeddingsEnabled: boolean,
  embeddingsCfg: { modelsBasePath: string; allowRemoteModels: boolean }
): Promise<RankedTraining[]> {
  const lexical = rankLexical(records, query, index);
  if (!embeddingsEnabled || lexical.length === 0) return lexical;

  try {
    // Dynamic import keeps the base bundle smaller and avoids loading runtime deps
    // unless embeddings are actually enabled.
    const { cosineSimilarity, embedText, loadEmbeddingsPipeline } = await import("../lib/embeddings");
    const pipe = await loadEmbeddingsPipeline(embeddingsCfg);
    const qVec = await embedText(pipe, query);

    // Blend lexical + embedding similarity.
    const byId = new Map<string, RankedTraining>();
    for (const r of lexical) byId.set(r.record.id, r);

    // Compute embeddings for the top lexical candidates only (cost control).
    const top = lexical.slice(0, 60);
    for (const entry of top) {
      const id = entry.record.id;
      let vec = await loadEmbedding(id);
      if (!vec) {
        vec = await embedText(pipe, entry.record.searchText);
        await saveEmbedding(id, vec);
      }
      const sim = cosineSimilarity(qVec, vec); // already normalized => dot product
      entry.score = entry.score + sim * 2.0;
      if (sim > 0.35) entry.reasons.push("semantic similarity");
    }

    const merged = [...byId.values()];
    merged.sort((a, b) => b.score - a.score);
    return merged;
  } catch {
    // If embeddings are not available locally, fall back to lexical.
    return lexical;
  }
}

export function App() {
  const [cfg, setCfg] = useState<AppConfig>(() => loadConfig());
  const [records, setRecords] = useState<TrainingRecord[] | null>(null);
  const [index, setIndex] = useState<LexicalIndex | null>(null);
  const [loading, setLoading] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "bot",
      text:
        "Tell me what training you need (topic, what you want to achieve). You can also mention language, modality (online / in-person / blended), platform (OpenWHO / WHO Academy / HSLP), or audience."
    }
  ]);
  const [input, setInput] = useState("");
  const [intent, setIntent] = useState<Intent>({ query: "" });
  const [lastResults, setLastResults] = useState<RankedTraining[] | null>(null);

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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Load cached first (fast), then refresh.
    loadData(true).catch((e) => {
      setMessages((m) => [
        ...m,
        { role: "bot", text: `Could not load SharePoint list items.\n${String(e)}` }
      ]);
    });
  }, []);

  async function runSearch(userText: string) {
    if (!records || !index) return;

    const nextIntent = mergeIntent(intent, userText);
    setIntent(nextIntent);

    const minUsefulQueryLen = 4;
    const hasSomeConstraint =
      Boolean(nextIntent.modality) ||
      Boolean(nextIntent.language) ||
      Boolean(nextIntent.platform) ||
      Boolean(nextIntent.audienceContains);

    if (!hasSomeConstraint && nextIntent.query.trim().length < minUsefulQueryLen) {
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text:
            "I can help, but I need a bit more detail. What topic or objective are you targeting (for example: IHR, RCCE, surveillance, laboratory, incident management)?"
        }
      ]);
      return;
    }

    const filtered = applyStructuredFilters(records, {
      modality: nextIntent.modality,
      language: nextIntent.language,
      platform: nextIntent.platform,
      audienceContains: nextIntent.audienceContains
    });

    const ranked = await rankHybrid(
      filtered,
      nextIntent.query,
      index,
      cfg.enableEmbeddings,
      { modelsBasePath: cfg.modelsBasePath, allowRemoteModels: cfg.allowRemoteModels }
    );
    const top = ranked.slice(0, 12);
    setLastResults(top);

    const summaryParts: string[] = [];
    if (nextIntent.language) summaryParts.push(`language: ${nextIntent.language}`);
    if (nextIntent.modality) summaryParts.push(`modality: ${nextIntent.modality}`);
    if (nextIntent.platform) summaryParts.push(`platform: ${nextIntent.platform}`);
    if (nextIntent.audienceContains) summaryParts.push(`audience contains: ${nextIntent.audienceContains}`);

    setMessages((m) => [
      ...m,
      {
        role: "bot",
        text:
          `I found ${ranked.length} match(es)` +
          (summaryParts.length ? ` (${summaryParts.join(", ")}).` : ".") +
          ` Showing top ${top.length}.`
      }
    ]);
  }

  async function onSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    if (!canSearch) {
      setMessages((m) => [...m, { role: "bot", text: "Loading training data—try again in a few seconds." }]);
      return;
    }
    await runSearch(text);
  }

  function onSaveConfig(next: AppConfig) {
    setCfg(next);
    saveConfig(next);
    setConfigOpen(false);
    setMessages((m) => [
      ...m,
      { role: "bot", text: "Saved configuration. Use Refresh to reload from the configured list." }
    ]);
  }

  return (
    <div class="container">
      <div class="header">
        <div>
          <div class="title">WHO Training Finder</div>
          <div class="small">
            Data source: SharePoint list copy via REST (`/_api`) — no external AI calls by default.
          </div>
        </div>
        <div class="controls">
          <button class="primary" disabled={loading} onClick={() => loadData(false)}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button onClick={() => setConfigOpen((v) => !v)}>{configOpen ? "Close config" : "Config"}</button>
        </div>
      </div>

      <div class="grid">
        <div class="panel chat">
          <div class="messages">
            {messages.map((m) => (
              <div class={`message ${m.role}`}>{m.text}</div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div class="composer">
            <input
              type="text"
              value={input}
              placeholder="Describe what you need…"
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
            <ConfigPanel cfg={cfg} onSave={onSaveConfig} />
          </div>
        )}

        {lastResults && (
          <div class="panel results">
            {lastResults.map((r) => (
              <div class="card">
                <div class="cardTitle">{r.record.learningName}</div>
                <div class="small">{r.record.description}</div>
                <div class="pillRow">
                  {r.record.technicalArea && <span class="pill">{r.record.technicalArea}</span>}
                  {r.record.focusArea && <span class="pill">{r.record.focusArea}</span>}
                  {r.record.modality && <span class="pill">{r.record.modality}</span>}
                  {r.record.platform && <span class="pill">{r.record.platform}</span>}
                  {r.record.languages.length > 0 && <span class="pill">{r.record.languages.join(", ")}</span>}
                </div>
                {r.record.normalizedLink && (
                  <div class="small">
                    Link:{" "}
                    <a href={r.record.normalizedLink} target="_blank" rel="noreferrer">
                      {r.record.normalizedLink}
                    </a>
                  </div>
                )}
                {r.reasons.length > 0 && <div class="small">Why: {r.reasons.join(", ")}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigPanel(props: { cfg: AppConfig; onSave: (cfg: AppConfig) => void }) {
  const [dataSource, setDataSource] = useState<AppConfig["dataSource"]>(props.cfg.dataSource);
  const [siteRelativeUrl, setSiteRelativeUrl] = useState(props.cfg.siteRelativeUrl);
  const [listTitle, setListTitle] = useState(props.cfg.listTitle);
  const [enableEmbeddings, setEnableEmbeddings] = useState(props.cfg.enableEmbeddings);
  const [modelsBasePath, setModelsBasePath] = useState(props.cfg.modelsBasePath);
  const [allowRemoteModels, setAllowRemoteModels] = useState(props.cfg.allowRemoteModels);

  return (
    <div class="configGrid">
      <label>
        Data source
        <select value={dataSource} onChange={(e) => setDataSource((e.target as HTMLSelectElement).value as AppConfig["dataSource"])}>
          <option value="sharepoint">SharePoint list (recommended)</option>
          <option value="demo_json">Local demo JSON (generated from provided CSV)</option>
        </select>
      </label>

      <label>
        Site relative URL (where the COPY list lives)
        <input type="text" value={siteRelativeUrl} onInput={(e) => setSiteRelativeUrl((e.target as HTMLInputElement).value)} />
      </label>

      <label>
        List title (COPY list)
        <input type="text" value={listTitle} onInput={(e) => setListTitle((e.target as HTMLInputElement).value)} />
      </label>

      <label>
        Models base path (relative to app)
        <input type="text" value={modelsBasePath} onInput={(e) => setModelsBasePath((e.target as HTMLInputElement).value)} />
      </label>

      <label>
        <input type="checkbox" checked={enableEmbeddings} onChange={(e) => setEnableEmbeddings((e.target as HTMLInputElement).checked)} />
        Enable semantic embeddings (client-side)
      </label>

      <label>
        <input type="checkbox" checked={allowRemoteModels} onChange={(e) => setAllowRemoteModels((e.target as HTMLInputElement).checked)} />
        Allow remote model downloads (default off)
      </label>

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
              modelsBasePath: modelsBasePath.trim(),
              allowRemoteModels
            })
          }
        >
          Save
        </button>
      </div>

      <div class="small">
        If embeddings are enabled and remote downloads are disabled, deploy the model folder under the configured models base path.
      </div>
    </div>
  );
}

