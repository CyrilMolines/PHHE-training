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

type LinkStatus = "pending" | "checking" | "ok" | "warning" | "error" | "timeout";

interface LinkResult {
  record: TrainingRecord;
  status: LinkStatus;
  statusCode?: number;
  error?: string;
  responseTime?: number;
}

export function LinkValidator() {
  const [records, setRecords] = useState<TrainingRecord[] | null>(null);
  const [results, setResults] = useState<LinkResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  async function startValidation() {
    if (!records || isChecking) return;
    
    setIsChecking(true);
    setProgress(0);

    // Reset all to pending
    setResults(records.map(record => ({ record, status: "pending" as LinkStatus })));

    const total = records.length;
    let checked = 0;

    // Check links sequentially to avoid overwhelming the browser
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const url = record.normalizedLink;

      // Update status to checking
      setResults(prev => {
        const updated = [...prev];
        updated[i] = { ...updated[i], status: "checking" };
        return updated;
      });

      if (!url) {
        // No link - mark as warning
        setResults(prev => {
          const updated = [...prev];
          updated[i] = { record, status: "warning", error: "No URL provided" };
          return updated;
        });
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
              <button 
                class="validator-btn primary"
                onClick={startValidation}
                disabled={isChecking}
              >
                {isChecking ? `Checking... ${progress}%` : "Start Validation"}
              </button>
              
              {stats.error > 0 && !isChecking && (
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
              <div class="stat">
                <span class="stat-value">{stats.total}</span>
                <span class="stat-label">Total</span>
              </div>
              <div class="stat ok">
                <span class="stat-value">{stats.ok}</span>
                <span class="stat-label">Working</span>
              </div>
              <div class="stat warning">
                <span class="stat-value">{stats.warning}</span>
                <span class="stat-label">Warnings</span>
              </div>
              <div class="stat error">
                <span class="stat-value">{stats.error}</span>
                <span class="stat-label">Broken</span>
              </div>
            </div>

            <div class="validator-results">
              {results.map((r, i) => (
                <div key={i} class={`result-row ${r.status}`}>
                  <div class="result-status">
                    {r.status === "pending" && <span class="status-icon">○</span>}
                    {r.status === "checking" && <span class="status-icon spin">◌</span>}
                    {r.status === "ok" && <span class="status-icon">✓</span>}
                    {r.status === "warning" && <span class="status-icon">⚠</span>}
                    {(r.status === "error" || r.status === "timeout") && <span class="status-icon">✗</span>}
                  </div>
                  <div class="result-info">
                    <div class="result-name">{r.record.learningName}</div>
                    <div class="result-url">{r.record.normalizedLink || "No URL"}</div>
                    {r.error && <div class="result-error">{r.error}</div>}
                  </div>
                  {r.responseTime !== undefined && (
                    <div class="result-time">{r.responseTime}ms</div>
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
