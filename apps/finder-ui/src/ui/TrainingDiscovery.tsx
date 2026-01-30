import { useEffect, useState } from "preact/hooks";
import type { TrainingRecord } from "../lib/schema";
import { loadDemoTrainings } from "../lib/demo";

// ============ CONFIGURATION ============
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    site: params.get("site"),
    list: params.get("list"),
    mode: params.get("mode")
  };
}

function detectDataSource(): "demo_json" | "sharepoint" {
  const params = getUrlParams();
  if (params.mode === "sharepoint") return "sharepoint";
  if (params.mode === "demo") return "demo_json";
  if (window.location.hostname.includes("sharepoint.com")) return "sharepoint";
  return "demo_json";
}

const URL_PARAMS = getUrlParams();

const CONFIG = {
  dataSource: detectDataSource(),
  sharepoint: {
    siteRelativeUrl: URL_PARAMS.site || "/sites/EuroWCPHE",
    listTitle: URL_PARAMS.list || "Copytraininglist2912026"
  }
};

// Known training sources for health emergencies
const TRAINING_SOURCES = [
  { name: "OpenWHO", url: "https://openwho.org/courses", category: "WHO", searchUrl: "https://openwho.org/courses?q=" },
  { name: "WHO eLearning", url: "https://www.who.int/emergencies/training", category: "WHO" },
  { name: "Coursera - Public Health", url: "https://www.coursera.org/browse/health/public-health", category: "MOOC", searchUrl: "https://www.coursera.org/search?query=" },
  { name: "edX - Public Health", url: "https://www.edx.org/learn/public-health", category: "MOOC", searchUrl: "https://www.edx.org/search?q=" },
  { name: "FutureLearn - Health", url: "https://www.futurelearn.com/subjects/healthcare-medicine-courses", category: "MOOC" },
  { name: "GOARN", url: "https://extranet.who.int/goarn/", category: "WHO" },
  { name: "CDC TRAIN", url: "https://www.train.org/cdctrain/", category: "CDC" },
  { name: "FEMA Emergency Management", url: "https://training.fema.gov/is/", category: "FEMA" },
  { name: "DisasterReady", url: "https://ready.csod.com/", category: "Humanitarian" },
  { name: "Humanitarian Leadership Academy", url: "https://kayaconnect.org/", category: "Humanitarian" },
  { name: "UNHCR Learn", url: "https://www.unhcr.org/learn/", category: "UN" },
  { name: "ReliefWeb Learning", url: "https://reliefweb.int/training", category: "Humanitarian" }
];

// Health emergency keywords for searching
const SEARCH_KEYWORDS = [
  "health emergency",
  "epidemic response",
  "pandemic preparedness",
  "outbreak investigation",
  "disease surveillance",
  "emergency management health",
  "cholera outbreak",
  "infectious disease emergency",
  "public health emergency",
  "humanitarian health response",
  "emergency medical response",
  "disaster health",
  "mass casualty",
  "field epidemiology"
];

interface DiscoveredTraining {
  title: string;
  url: string;
  source: string;
  description?: string;
  isNew: boolean;
  addedToExport: boolean;
}

export function TrainingDiscovery() {
  const [existingRecords, setExistingRecords] = useState<TrainingRecord[] | null>(null);
  const [existingUrls, setExistingUrls] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manual URL input
  const [manualUrl, setManualUrl] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  
  // Discovered trainings
  const [discoveries, setDiscoveries] = useState<DiscoveredTraining[]>([]);
  
  // Export list
  const [exportList, setExportList] = useState<DiscoveredTraining[]>([]);

  // Load existing data on mount
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const data = CONFIG.dataSource === "demo_json"
        ? await loadDemoTrainings()
        : await loadSharePointData();
      
      setExistingRecords(data);
      
      // Build set of existing URLs (normalized)
      const urls = new Set<string>();
      data.forEach(r => {
        if (r.normalizedLink) {
          urls.add(normalizeUrl(r.normalizedLink));
        }
      });
      setExistingUrls(urls);
    } catch (e) {
      console.error("Failed to load data:", e);
      setError("Failed to load existing training data.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSharePointData(): Promise<TrainingRecord[]> {
    const { fetchAllListItems } = await import("../lib/sharepoint");
    return fetchAllListItems({
      siteRelativeUrl: CONFIG.sharepoint.siteRelativeUrl,
      listTitle: CONFIG.sharepoint.listTitle
    });
  }

  function normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.hostname + u.pathname.replace(/\/$/, "").toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  function checkIfNew(url: string): boolean {
    const normalized = normalizeUrl(url);
    return !existingUrls.has(normalized);
  }

  function addManualEntry() {
    if (!manualUrl.trim()) return;
    
    const isNew = checkIfNew(manualUrl);
    const entry: DiscoveredTraining = {
      title: manualTitle.trim() || "Untitled Training",
      url: manualUrl.trim(),
      source: "Manual Entry",
      isNew,
      addedToExport: false
    };
    
    setDiscoveries(prev => [entry, ...prev]);
    setManualUrl("");
    setManualTitle("");
  }

  function toggleExport(index: number) {
    setDiscoveries(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], addedToExport: !updated[index].addedToExport };
      return updated;
    });
  }

  function generateExport() {
    const toExport = discoveries.filter(d => d.addedToExport && d.isNew);
    
    if (toExport.length === 0) {
      alert("No new trainings selected for export.");
      return;
    }
    
    // Generate CSV
    let csv = "Title,URL,Source,Notes\n";
    toExport.forEach(d => {
      csv += `"${d.title.replace(/"/g, '""')}","${d.url}","${d.source}","Pending review"\n`;
    });
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `discovered-trainings-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function generateEmailDraft() {
    const toExport = discoveries.filter(d => d.addedToExport && d.isNew);
    
    if (toExport.length === 0) {
      alert("No new trainings selected.");
      return;
    }
    
    const subject = encodeURIComponent("New Training Resources for Review");
    let body = "Hello,\n\nThe following new training resources have been identified for potential addition to the WHO PHHE Training Directory:\n\n";
    
    toExport.forEach((d, i) => {
      body += `${i + 1}. ${d.title}\n   URL: ${d.url}\n   Source: ${d.source}\n\n`;
    });
    
    body += "\nPlease review and add approved trainings to the directory.\n\nBest regards";
    
    window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(body)}`);
  }

  const newCount = discoveries.filter(d => d.isNew).length;
  const selectedCount = discoveries.filter(d => d.addedToExport && d.isNew).length;

  return (
    <div class="discovery-container">
      <div class="discovery-header">
        <div class="discovery-header-text">
          <span class="discovery-title">WHO PHHE Training Discovery</span>
          <span class="discovery-subtitle">Find and submit new training resources</span>
        </div>
      </div>

      <div class="discovery-content">
        {loading && (
          <div class="discovery-loading">Loading existing training data...</div>
        )}

        {error && (
          <div class="discovery-error">{error}</div>
        )}

        {!loading && !error && (
          <>
            {/* Stats */}
            <div class="discovery-stats">
              <div class="stat">
                <span class="stat-value">{existingRecords?.length || 0}</span>
                <span class="stat-label">Existing Trainings</span>
              </div>
              <div class="stat new">
                <span class="stat-value">{newCount}</span>
                <span class="stat-label">New Found</span>
              </div>
              <div class="stat selected">
                <span class="stat-value">{selectedCount}</span>
                <span class="stat-label">Selected</span>
              </div>
            </div>

            {/* Manual Entry */}
            <div class="discovery-section">
              <h3>Add Training URL</h3>
              <p class="section-desc">Paste a training URL to check if it's already in the directory</p>
              <div class="manual-input-group">
                <input
                  type="text"
                  placeholder="Training title (optional)"
                  value={manualTitle}
                  onInput={(e) => setManualTitle((e.target as HTMLInputElement).value)}
                  class="manual-input"
                />
                <input
                  type="url"
                  placeholder="https://example.com/training"
                  value={manualUrl}
                  onInput={(e) => setManualUrl((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => e.key === "Enter" && addManualEntry()}
                  class="manual-input url"
                />
                <button class="btn primary" onClick={addManualEntry}>
                  Check URL
                </button>
              </div>
            </div>

            {/* Known Sources */}
            <div class="discovery-section">
              <h3>Browse Training Sources</h3>
              <p class="section-desc">Click to open known health emergency training platforms</p>
              <div class="sources-grid">
                {TRAINING_SOURCES.map((source, i) => (
                  <a key={i} href={source.url} target="_blank" rel="noreferrer" class="source-card">
                    <span class="source-name">{source.name}</span>
                    <span class="source-category">{source.category}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Search Keywords */}
            <div class="discovery-section">
              <h3>Search Keywords</h3>
              <p class="section-desc">Use these keywords to search for trainings on the platforms above</p>
              <div class="keywords-list">
                {SEARCH_KEYWORDS.map((kw, i) => (
                  <span key={i} class="keyword-tag">{kw}</span>
                ))}
              </div>
            </div>

            {/* Discovered List */}
            {discoveries.length > 0 && (
              <div class="discovery-section">
                <h3>Checked URLs ({discoveries.length})</h3>
                <div class="discoveries-list">
                  {discoveries.map((d, i) => (
                    <div key={i} class={`discovery-item ${d.isNew ? "new" : "existing"}`}>
                      <div class="discovery-checkbox">
                        {d.isNew && (
                          <input
                            type="checkbox"
                            checked={d.addedToExport}
                            onChange={() => toggleExport(i)}
                          />
                        )}
                      </div>
                      <div class="discovery-info">
                        <div class="discovery-title-row">
                          <span class="discovery-name">{d.title}</span>
                          <span class={`discovery-badge ${d.isNew ? "new" : "existing"}`}>
                            {d.isNew ? "NEW" : "Already exists"}
                          </span>
                        </div>
                        <a href={d.url} target="_blank" rel="noreferrer" class="discovery-url">
                          {d.url}
                        </a>
                        <span class="discovery-source">Source: {d.source}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export Actions */}
            {selectedCount > 0 && (
              <div class="discovery-actions">
                <button class="btn primary" onClick={generateExport}>
                  Export CSV ({selectedCount})
                </button>
                <button class="btn secondary" onClick={generateEmailDraft}>
                  Draft Email
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
