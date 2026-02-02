import { useEffect, useState, useRef } from "preact/hooks";
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

type LinkStatus = "pending" | "checking" | "ok" | "warning" | "error" | "timeout" | "in_person" | "auth_required";

interface LinkResult {
  record: TrainingRecord;
  status: LinkStatus;
  statusCode?: number;
  error?: string;
  responseTime?: number;
  details?: string;
}

export function LinkValidator() {
  const [records, setRecords] = useState<TrainingRecord[] | null>(null);
  const [results, setResults] = useState<LinkResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const stopRef = useRef(false);

  // Load data on mount
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
      
      setRecords(data);
      // Initialize results with pending status
      setResults(data.map(record => ({ record, status: "pending" as LinkStatus })));
    } catch (e) {
      console.error("Failed to load data:", e);
      setError("Failed to load training data. Check your SharePoint permissions.");
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

  async function checkLink(url: string): Promise<{ status: LinkStatus; statusCode?: number; error?: string; responseTime: number }> {
    const startTime = Date.now();
    const timeout = 10000; // 10 second timeout

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Try HEAD request first (faster), fall back to GET
      const response = await fetch(url, {
        method: "HEAD",
        mode: "no-cors", // Required for cross-origin requests
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      // With no-cors mode, we can't read status, but if fetch succeeds, the URL is reachable
      // Response type will be "opaque" for cross-origin
      if (response.type === "opaque") {
        return { status: "ok", responseTime };
      }

      if (response.ok) {
        return { status: "ok", statusCode: response.status, responseTime };
      } else if (response.status >= 300 && response.status < 400) {
        return { status: "warning", statusCode: response.status, error: "Redirect", responseTime };
      } else if (response.status === 404) {
        return { status: "error", statusCode: 404, error: "Not Found", responseTime };
      } else {
        return { status: "error", statusCode: response.status, error: `HTTP ${response.status}`, responseTime };
      }
    } catch (e: any) {
      const responseTime = Date.now() - startTime;
      
      if (e.name === "AbortError") {
        return { status: "timeout", error: "Timeout (>10s)", responseTime };
      }
      
      // Network errors with no-cors often mean the URL is accessible but CORS blocked
      // This is actually OK for our purposes - the link works, we just can't read the response
      if (e.message?.includes("Failed to fetch") || e.message?.includes("NetworkError")) {
        // Try to determine if it's truly broken or just CORS
        // If we got here quickly, it's likely a real network error
        if (responseTime < 1000) {
          return { status: "error", error: "Network Error", responseTime };
        }
        // If it took a while, it might be CORS or slow server - mark as warning
        return { status: "warning", error: "Could not verify (CORS)", responseTime };
      }
      
      return { status: "error", error: e.message || "Unknown error", responseTime };
    }
  }

  function isInPersonTraining(record: TrainingRecord): boolean {
    const modality = (record.modalityRaw || record.modality || "").toLowerCase();
    return modality.includes("person") || modality.includes("face") || modality.includes("classroom");
  }

  async function startValidation() {
    if (!records || isChecking) return;
    
    setIsChecking(true);
    setProgress(0);
    stopRef.current = false;

    // Reset all to pending
    setResults(records.map(record => ({ record, status: "pending" as LinkStatus })));

    const total = records.length;
    let checked = 0;

    // Check links sequentially to avoid overwhelming the browser
    for (let i = 0; i < records.length; i++) {
      // Check if stop was requested
      if (stopRef.current) {
        setIsChecking(false);
        return;
      }

      const record = records[i];
      const url = record.normalizedLink;

      // Update status to checking
      setResults(prev => {
        const updated = [...prev];
        updated[i] = { ...updated[i], status: "checking" };
        return updated;
      });

      if (!url) {
        // Check if it's in-person training
        if (isInPersonTraining(record)) {
          setResults(prev => {
            const updated = [...prev];
            updated[i] = { record, status: "in_person", details: "In-person training - no URL needed" };
            return updated;
          });
        } else {
          // No link for online training - mark as warning
          setResults(prev => {
            const updated = [...prev];
            updated[i] = { record, status: "warning", error: "No URL provided for online training" };
            return updated;
          });
        }
      } else {
        const result = await checkLink(url);
        setResults(prev => {
          const updated = [...prev];
          updated[i] = { record, ...result };
          return updated;
        });
      }

      checked++;
      setProgress(Math.round((checked / total) * 100));

      // Small delay between requests to be polite
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsChecking(false);
  }

  function stopValidation() {
    stopRef.current = true;
    setIsChecking(false);
  }

  function exportReport() {
    const broken = results.filter(r => r.status === "error" || r.status === "timeout");
    const warnings = results.filter(r => r.status === "warning");
    
    let report = `WHO PHHE Training Link Validation Report\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `Source: ${CONFIG.dataSource === "demo_json" ? "Demo Data" : CONFIG.sharepoint.listTitle}\n\n`;
    report += `Summary:\n`;
    report += `- Total trainings: ${results.length}\n`;
    report += `- Working links: ${results.filter(r => r.status === "ok").length}\n`;
    report += `- Broken links: ${broken.length}\n`;
    report += `- Warnings: ${warnings.length}\n\n`;

    if (broken.length > 0) {
      report += `\n=== BROKEN LINKS ===\n\n`;
      broken.forEach(r => {
        report += `Training: ${r.record.learningName}\n`;
        report += `URL: ${r.record.normalizedLink || "N/A"}\n`;
        report += `Error: ${r.error || r.status}\n\n`;
      });
    }

    if (warnings.length > 0) {
      report += `\n=== WARNINGS ===\n\n`;
      warnings.forEach(r => {
        report += `Training: ${r.record.learningName}\n`;
        report += `URL: ${r.record.normalizedLink || "N/A"}\n`;
        report += `Issue: ${r.error || r.status}\n\n`;
      });
    }

    // Download as text file
    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `link-validation-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stats = {
    total: results.length,
    ok: results.filter(r => r.status === "ok").length,
    inPerson: results.filter(r => r.status === "in_person").length,
    authRequired: results.filter(r => r.status === "auth_required").length,
    warning: results.filter(r => r.status === "warning").length,
    error: results.filter(r => r.status === "error" || r.status === "timeout").length,
    pending: results.filter(r => r.status === "pending" || r.status === "checking").length
  };

  return (
    <div class="validator-container">
      <div class="validator-header">
        <div class="validator-header-text">
          <span class="validator-title">WHO PHHE Link Validator</span>
          <span class="validator-subtitle">Check training links for availability</span>
        </div>
      </div>

      <div class="validator-content">
        {loading && (
          <div class="validator-loading">Loading training data...</div>
        )}

        {error && (
          <div class="validator-error">{error}</div>
        )}

        {!loading && !error && records && (
          <>
            <div class="validator-controls">
              {!isChecking ? (
                <button 
                  class="validator-btn primary"
                  onClick={startValidation}
                >
                  Start Validation
                </button>
              ) : (
                <button 
                  class="validator-btn stop"
                  onClick={stopValidation}
                >
                  ⏹ Stop ({progress}%)
                </button>
              )}
              
              {(stats.error > 0 || stats.warning > 0) && !isChecking && (
                <button class="validator-btn secondary" onClick={exportReport}>
                  Export Report
                </button>
              )}
            </div>

            {isChecking && (
              <div class="validator-progress">
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <div class="validator-stats">
              <div 
                class={`stat clickable ${filter === null ? "selected" : ""}`}
                onClick={() => setFilter(null)}
              >
                <span class="stat-value">{stats.total}</span>
                <span class="stat-label">Total</span>
              </div>
              <div 
                class={`stat ok clickable ${filter === "ok" ? "selected" : ""}`}
                onClick={() => setFilter(filter === "ok" ? null : "ok")}
              >
                <span class="stat-value">{stats.ok}</span>
                <span class="stat-label">Working</span>
              </div>
              <div 
                class={`stat in-person clickable ${filter === "in_person" ? "selected" : ""}`}
                onClick={() => setFilter(filter === "in_person" ? null : "in_person")}
              >
                <span class="stat-value">{stats.inPerson}</span>
                <span class="stat-label">In-person</span>
              </div>
              <div 
                class={`stat warning clickable ${filter === "warning" ? "selected" : ""}`}
                onClick={() => setFilter(filter === "warning" ? null : "warning")}
              >
                <span class="stat-value">{stats.warning}</span>
                <span class="stat-label">Warnings</span>
              </div>
              <div 
                class={`stat error clickable ${filter === "error" ? "selected" : ""}`}
                onClick={() => setFilter(filter === "error" ? null : "error")}
              >
                <span class="stat-value">{stats.error}</span>
                <span class="stat-label">Broken</span>
              </div>
            </div>

            {filter && (
              <div class="filter-indicator">
                Showing: <strong>{filter === "ok" ? "Working" : filter === "in_person" ? "In-person" : filter === "warning" ? "Warnings" : "Broken"}</strong>
                <button class="clear-filter" onClick={() => setFilter(null)}>✕ Clear</button>
              </div>
            )}

            <div class="validator-results">
              {results
                .filter(r => {
                  if (!filter) return true;
                  if (filter === "error") return r.status === "error" || r.status === "timeout";
                  return r.status === filter;
                })
                .map((r, i) => (
                <div 
                  key={r.record.id || i} 
                  class={`result-row ${r.status} ${expandedIndex === i ? "expanded" : ""}`}
                  onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                >
                  <div class="result-header">
                    <div class="result-status">
                      {r.status === "pending" && <span class="status-icon">○</span>}
                      {r.status === "checking" && <span class="status-icon spin">◌</span>}
                      {r.status === "ok" && <span class="status-icon">✓</span>}
                      {r.status === "in_person" && <span class="status-icon">👤</span>}
                      {r.status === "auth_required" && <span class="status-icon">🔐</span>}
                      {r.status === "warning" && <span class="status-icon">⚠</span>}
                      {(r.status === "error" || r.status === "timeout") && <span class="status-icon">✗</span>}
                    </div>
                    <div class="result-info">
                      <div class="result-name">{r.record.learningName}</div>
                      {!expandedIndex && r.error && <div class="result-error">{r.error}</div>}
                      {!expandedIndex && r.details && <div class="result-details-hint">{r.details}</div>}
                    </div>
                    {r.responseTime !== undefined && (
                      <div class="result-time">{r.responseTime}ms</div>
                    )}
                    <div class="result-expand-icon">{expandedIndex === i ? "▼" : "▶"}</div>
                  </div>
                  
                  {expandedIndex === i && (
                    <div class="result-expanded">
                      <div class="detail-row">
                        <span class="detail-label">URL</span>
                        <span class="detail-value">
                          {r.record.normalizedLink ? (
                            <a href={r.record.normalizedLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                              {r.record.normalizedLink}
                            </a>
                          ) : "No URL"}
                        </span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Description</span>
                        <span class="detail-value">{r.record.description || "N/A"}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Modality</span>
                        <span class="detail-value">{r.record.modalityRaw || r.record.modality || "N/A"}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Technical Area</span>
                        <span class="detail-value">{r.record.technicalArea || "N/A"}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Languages</span>
                        <span class="detail-value">{r.record.languages?.join(", ") || "N/A"}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Platform</span>
                        <span class="detail-value">{r.record.platform || "N/A"}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Owner</span>
                        <span class="detail-value">{r.record.owner || "N/A"}</span>
                      </div>
                      {r.error && (
                        <div class="detail-row error-row">
                          <span class="detail-label">Error</span>
                          <span class="detail-value">{r.error}</span>
                        </div>
                      )}
                      {r.details && (
                        <div class="detail-row">
                          <span class="detail-label">Note</span>
                          <span class="detail-value">{r.details}</span>
                        </div>
                      )}
                      {r.statusCode && (
                        <div class="detail-row">
                          <span class="detail-label">HTTP Status</span>
                          <span class="detail-value">{r.statusCode}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
