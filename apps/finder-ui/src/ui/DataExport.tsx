import { useState } from "preact/hooks";
import Papa from "papaparse";
import type { TrainingRecord, Modality } from "../lib/schema";

// Column mappings for SharePoint export
const COLUMN_MAP: Record<string, keyof TrainingRecord | "languages_raw"> = {
  "Learning Name": "learningName",
  "Description": "description",
  "Technical Area": "technicalArea",
  "Focus Area": "focusArea",
  "Intended Audience": "intendedAudience",
  "Owner": "owner",
  "Developer": "developer",
  "Contact Details": "contactDetails",
  "Language(s)": "languages_raw",
  "Modality": "modalityRaw",
  "Platform": "platform",
  "Link": "link",
  "Comment": "comment",
  "Sign-off Status": "signoffStatus"
};

function normalizeModality(raw: string): Modality {
  const lower = raw?.toLowerCase() || "";
  if (lower.includes("online") && lower.includes("person")) return "blended";
  if (lower.includes("online")) return "online";
  if (lower.includes("person") || lower.includes("face")) return "in_person";
  if (lower.includes("toolkit") || lower.includes("tool")) return "toolkit";
  return "unknown";
}

function normalizeLink(raw: string): string {
  if (!raw) return "";
  let url = raw.trim();
  if (url && !url.startsWith("http")) {
    url = "https://" + url;
  }
  return url;
}

function parseLanguages(raw: string): string[] {
  if (!raw) return [];
  return raw.split(/[,;\/]/).map(s => s.trim()).filter(Boolean);
}

// Admin email for receiving data updates
const ADMIN_EMAIL = "molinescy@who.int";

export function DataExport() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [records, setRecords] = useState<TrainingRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [copied, setCopied] = useState(false);

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      setCsvFile(input.files[0]);
      setRecords(null);
      setError(null);
      setStatus("");
    }
  }

  function processCSV() {
    if (!csvFile) return;
    
    setStatus("Processing...");
    setError(null);
    
    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsed: TrainingRecord[] = [];
          
          for (let i = 0; i < results.data.length; i++) {
            const row = results.data[i] as Record<string, string>;
            
            // Map columns
            const record: Partial<TrainingRecord> = {
              id: `training-${i + 1}`,
              sourceRow: i + 1
            };
            
            for (const [csvCol, field] of Object.entries(COLUMN_MAP)) {
              const value = row[csvCol] || "";
              if (field === "languages_raw") {
                (record as any).languages = parseLanguages(value);
              } else {
                (record as any)[field] = value;
              }
            }
            
            // Normalize fields
            record.modality = normalizeModality(record.modalityRaw || "");
            record.normalizedLink = normalizeLink(record.link || "");
            
            // Build search text
            record.searchText = [
              record.learningName,
              record.description,
              record.technicalArea,
              record.focusArea,
              record.intendedAudience,
              ...(record.languages || [])
            ].filter(Boolean).join(" ").toLowerCase();
            
            parsed.push(record as TrainingRecord);
          }
          
          setRecords(parsed);
          setStatus(`Processed ${parsed.length} training records`);
        } catch (e: any) {
          setError(`Error processing CSV: ${e.message}`);
          setStatus("");
        }
      },
      error: (err) => {
        setError(`Error parsing CSV: ${err.message}`);
        setStatus("");
      }
    });
  }

  function downloadJSON() {
    if (!records) return;
    
    const json = JSON.stringify(records, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "demo-trainings.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyToClipboard() {
    if (!records) return;
    
    try {
      const json = JSON.stringify(records, null, 2);
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      setError("Failed to copy to clipboard. Try downloading instead.");
    }
  }

  function emailToAdmin() {
    if (!records) return;
    
    const subject = encodeURIComponent("WHO PHHE Training Data Update");
    const body = encodeURIComponent(
      `Hi,\n\n` +
      `Please update the training data on GitHub. I've attached the updated JSON file (demo-trainings.json).\n\n` +
      `Summary:\n` +
      `- Total trainings: ${records.length}\n` +
      `- Export date: ${new Date().toLocaleDateString()}\n\n` +
      `Instructions:\n` +
      `1. Download the attached demo-trainings.json file\n` +
      `2. Go to https://github.com/CyrilMolines/PHHE-training\n` +
      `3. Click Add file → Upload files\n` +
      `4. Upload demo-trainings.json (replace existing)\n` +
      `5. Commit changes\n\n` +
      `Thank you!`
    );
    
    // Download the file first so user can attach it
    downloadJSON();
    
    // Open email client
    window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <div class="export-container">
      <div class="export-header">
        <div class="export-header-text">
          <span class="export-title">WHO PHHE Data Export</span>
          <span class="export-subtitle">Convert SharePoint CSV to JSON for GitHub</span>
        </div>
      </div>

      <div class="export-content">
        <div class="export-section">
          <h3>Step 1: Export from SharePoint</h3>
          <ol class="export-steps">
            <li>Go to your SharePoint list</li>
            <li>Click <strong>Export</strong> → <strong>Export to CSV</strong></li>
            <li>Save the file to your computer</li>
          </ol>
        </div>

        <div class="export-section">
          <h3>Step 2: Select CSV File</h3>
          <input 
            type="file" 
            accept=".csv"
            onChange={handleFileSelect}
            class="file-input"
          />
          {csvFile && (
            <div class="file-info">
              Selected: <strong>{csvFile.name}</strong> ({Math.round(csvFile.size / 1024)} KB)
            </div>
          )}
        </div>

        <div class="export-section">
          <h3>Step 3: Convert to JSON</h3>
          <button 
            class="btn primary"
            onClick={processCSV}
            disabled={!csvFile}
          >
            Process CSV
          </button>
          
          {status && <div class="status-message">{status}</div>}
          {error && <div class="error-message">{error}</div>}
        </div>

        {records && (
          <>
            <div class="export-section success-section">
              <h3>✓ Conversion Complete!</h3>
              <p class="section-desc">
                <strong>{records.length}</strong> training records ready to upload.
              </p>
              
              <div class="upload-steps">
                <div class="step-card">
                  <div class="step-number">1</div>
                  <div class="step-content">
                    <h4>Download the JSON file</h4>
                    <button class="btn primary" onClick={downloadJSON}>
                      💾 Download demo-trainings.json
                    </button>
                  </div>
                </div>

                <div class="step-card">
                  <div class="step-number">2</div>
                  <div class="step-content">
                    <h4>Upload to GitHub</h4>
                    <p>Click below, then drag & drop your file and click "Commit changes"</p>
                    <a 
                      href="https://github.com/CyrilMolines/PHHE-training/upload/gh-pages" 
                      target="_blank"
                      class="btn primary"
                    >
                      📤 Open GitHub Upload Page
                    </a>
                  </div>
                </div>

                <div class="step-card">
                  <div class="step-number">3</div>
                  <div class="step-content">
                    <h4>Done!</h4>
                    <p>Changes go live within 1-2 minutes after commit.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="export-section">
              <details>
                <summary>Preview ({records.length} records)</summary>
                <div class="preview-box">
                  <pre>{JSON.stringify(records.slice(0, 2), null, 2)}
{records.length > 2 ? `\n... and ${records.length - 2} more records` : ""}</pre>
                </div>
              </details>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
