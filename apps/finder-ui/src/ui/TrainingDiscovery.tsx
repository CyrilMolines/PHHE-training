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
  { 
    name: "OpenWHO", 
    url: "https://openwho.org/", 
    category: "WHO", 
    searchUrl: "https://openwho.org/courses?q=",
    description: "WHO's interactive learning platform"
  },
  { 
    name: "WHO eLearning", 
    url: "https://www.who.int/emergencies/training", 
    category: "WHO",
    description: "Emergency training resources"
  },
  { 
    name: "edX - Public Health", 
    url: "https://www.edx.org/learn/public-health", 
    category: "MOOC", 
    searchUrl: "https://www.edx.org/search?tab=Course&productType=Course&q=",
    description: "Online courses from top universities"
  },
  { 
    name: "Coursera - Public Health", 
    url: "https://www.coursera.org/browse/health/public-health", 
    category: "MOOC", 
    searchUrl: "https://www.coursera.org/search?query=",
    description: "University courses and certificates"
  },
  { 
    name: "FutureLearn - Health", 
    url: "https://www.futurelearn.com/subjects/healthcare-medicine-courses", 
    category: "MOOC",
    description: "Healthcare and medicine courses"
  },
  { 
    name: "CDC TRAIN", 
    url: "https://www.train.org/cdctrain/welcome", 
    category: "CDC", 
    searchUrl: "https://www.train.org/cdctrain/search?query=",
    description: "CDC training resources"
  },
  { 
    name: "FEMA Emergency Management", 
    url: "https://training.fema.gov/is/crslist.aspx", 
    category: "FEMA",
    description: "Emergency management courses"
  },
  { 
    name: "DisasterReady", 
    url: "https://ready.csod.com/client/disasterready/default.aspx", 
    category: "Humanitarian",
    description: "Humanitarian learning platform"
  },
  { 
    name: "Kaya (HLA)", 
    url: "https://kayaconnect.org/course/index.php", 
    category: "Humanitarian", 
    searchUrl: "https://kayaconnect.org/course/search.php?search=",
    description: "Humanitarian Leadership Academy"
  },
  { 
    name: "UNHCR Learning", 
    url: "https://www.unhcr.org/what-we-do/build-better-futures/education", 
    category: "UN",
    description: "UNHCR education resources"
  },
  { 
    name: "ReliefWeb Training", 
    url: "https://reliefweb.int/training", 
    category: "Humanitarian", 
    searchUrl: "https://reliefweb.int/training?search=",
    description: "Humanitarian training opportunities"
  },
  { 
    name: "GOARN", 
    url: "https://extranet.who.int/goarn/", 
    category: "WHO",
    description: "Global Outbreak Alert and Response Network (login required)"
  }
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

  // Search state
  const [searchQuery, setSearchQuery] = useState("public health emergency");
  const [isSearching, setIsSearching] = useState(false);
  
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

  function searchAllSources() {
    // Open search pages for all sources that have search URLs
    const query = encodeURIComponent(searchQuery);
    const sourcesWithSearch = TRAINING_SOURCES.filter(s => s.searchUrl);
    
    sourcesWithSearch.forEach((source, index) => {
      setTimeout(() => {
        window.open(source.searchUrl + query, '_blank');
      }, index * 500); // Stagger to avoid popup blocking
    });
  }

  function searchSource(source: typeof TRAINING_SOURCES[0]) {
    if (source.searchUrl) {
      const query = encodeURIComponent(searchQuery);
      window.open(source.searchUrl + query, '_blank');
    } else {
      window.open(source.url, '_blank');
    }
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

            {/* Search Section */}
            <div class="discovery-section search-section">
              <h3>🔍 Search Training Sources</h3>
              <p class="section-desc">Search all platforms for new trainings on a specific topic</p>
              <div class="search-input-group">
                <input
                  type="text"
                  placeholder="Enter search terms..."
                  value={searchQuery}
                  onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                  class="search-input"
                />
                <button class="btn primary" onClick={searchAllSources}>
                  Search All Sources
                </button>
              </div>
              <div class="quick-searches">
                <span class="quick-label">Quick searches:</span>
                {SEARCH_KEYWORDS.slice(0, 6).map((kw, i) => (
                  <button 
                    key={i} 
                    class="keyword-btn"
                    onClick={() => setSearchQuery(kw)}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>

            {/* Training Sources */}
            <div class="discovery-section">
              <h3>📚 Training Platforms</h3>
              <p class="section-desc">Click "Search" to find trainings, or "Browse" to explore the platform</p>
              <div class="sources-list">
                {TRAINING_SOURCES.map((source, i) => (
                  <div key={i} class="source-row">
                    <div class="source-info">
                      <span class="source-name">{source.name}</span>
                      <span class="source-desc">{source.description}</span>
                    </div>
                    <span class="source-category-badge">{source.category}</span>
                    <div class="source-actions">
                      {source.searchUrl && (
                        <button 
                          class="btn small primary"
                          onClick={() => searchSource(source)}
                        >
                          🔍 Search
                        </button>
                      )}
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        class="btn small secondary"
                      >
                        Browse
                      </a>
                    </div>
                  </div>
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
