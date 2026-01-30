#!/usr/bin/env node
/**
 * WHO PHHE Training Link Validator
 * 
 * Deep content validation - checks if training content is actually available,
 * not just if the URL responds.
 * 
 * Usage:
 *   node validate-links.js [path-to-json-or-csv]
 * 
 * If no file is provided, uses the demo-trainings.json from the project.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// Allow self-signed certificates (common on WHO/UN sites)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// ============ CONFIGURATION ============
const CONFIG = {
  timeout: 15000,           // 15 second timeout per URL
  concurrency: 5,           // Check 5 URLs at a time
  retries: 2,               // Retry failed requests
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

// Patterns that indicate content is unavailable (truly broken)
const UNAVAILABLE_PATTERNS = [
  // Generic 404/not found
  /page\s*(not|cannot be)\s*found/i,
  /404\s*(error|not found)/i,
  /content\s*(is\s*)?(no longer|not)\s*(available|found)/i,
  /this\s*page\s*(doesn't|does not)\s*exist/i,
  /sorry.*couldn't find/i,
  /we\s*couldn't\s*find/i,
  /no\s*longer\s*available/i,
  /has\s*been\s*(removed|deleted|taken down)/i,
  
  // Video platforms - truly removed
  /video\s*(is\s*)?(unavailable|removed|deleted)/i,
  /this\s*video\s*(is\s*)?no longer available/i,
  /video\s*does\s*not\s*exist/i,
  /this\s*video\s*has\s*been\s*removed/i,
  
  // Course platforms - ended/removed
  /course\s*(is\s*)?(unavailable|closed|ended)/i,
  /this\s*course\s*(is\s*)?no longer (available|offered)/i,
  /course\s*has\s*ended/i,
  
  // Learning platforms - removed
  /training\s*(is\s*)?(unavailable|removed|discontinued)/i,
  /module\s*(is\s*)?(unavailable|removed)/i,
  /resource\s*not\s*found/i
];

// Patterns that indicate login/registration required (NOT broken, just restricted)
const LOGIN_REQUIRED_PATTERNS = [
  /sign\s*in\s*to\s*(continue|access|view)/i,
  /log\s*in\s*to\s*(continue|access|view)/i,
  /login\s*required/i,
  /please\s*(log|sign)\s*in/i,
  /authentication\s*required/i,
  /you\s*must\s*(be\s*)?(logged|signed)\s*in/i,
  /register\s*to\s*(access|view|continue)/i,
  /create\s*(an\s*)?account\s*to/i,
  /access\s*denied/i,
  /unauthorized/i,
  /forbidden/i,
  /sso\s*login/i,
  /single\s*sign[- ]on/i,
  /<form[^>]*login/i,
  /<input[^>]*password/i,
  /adfs|saml|oauth/i
];

// Known domains that require authentication
const AUTH_REQUIRED_DOMAINS = [
  "extranet.who.int",
  "login.microsoftonline.com",
  "login.who.int",
  "goarnlms.org",
  "ilearn.who.int"
];

// Patterns that indicate content IS available
const AVAILABLE_PATTERNS = [
  // Video indicators
  /<video[\s>]/i,
  /video-player/i,
  /youtube\.com\/embed/i,
  /vimeo\.com\/video/i,
  /player\.vimeo\.com/i,
  /wistia/i,
  /jwplayer/i,
  
  // Course indicators
  /enroll\s*(now)?/i,
  /start\s*(learning|course|training)/i,
  /begin\s*(course|training|module)/i,
  /course\s*content/i,
  /course\s*overview/i,
  /learning\s*objectives/i,
  /module\s*\d+/i,
  /lesson\s*\d+/i,
  
  // Training indicators
  /training\s*materials?/i,
  /download\s*(materials?|resources?)/i,
  /complete\s*this\s*(course|training|module)/i
];

// ============ UTILITIES ============

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = "";
    let inQuotes = false;
    
    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const record = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] || "";
    });
    records.push(record);
  }
  
  return records;
}

function normalizeRecord(raw) {
  // Handle both JSON format and CSV format
  return {
    id: raw.id || raw.ID || `row-${Math.random().toString(36).slice(2)}`,
    learningName: raw.learningName || raw["Learning Name"] || raw.Title || "Unknown",
    link: raw.normalizedLink || raw.link || raw.Link || raw.URL || "",
    technicalArea: raw.technicalArea || raw["Technical Area"] || "",
    platform: raw.platform || raw.Platform || ""
  };
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const startTime = Date.now();
    
    const options = {
      headers: {
        "User-Agent": CONFIG.userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      },
      timeout: CONFIG.timeout
    };
    
    const req = protocol.get(url, options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith("http") 
          ? res.headers.location 
          : new URL(res.headers.location, url).href;
        
        // Follow redirect (limit to 5 redirects)
        if (!fetchUrl.redirectCount) fetchUrl.redirectCount = 0;
        if (fetchUrl.redirectCount++ < 5) {
          fetchUrl(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }
      
      fetchUrl.redirectCount = 0;
      
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body,
          responseTime: Date.now() - startTime,
          finalUrl: url
        });
      });
    });
    
    req.on("error", (err) => {
      reject({ error: err.message, responseTime: Date.now() - startTime });
    });
    
    req.on("timeout", () => {
      req.destroy();
      reject({ error: "Timeout", responseTime: CONFIG.timeout });
    });
  });
}

function analyzeContent(html, url) {
  const issues = [];
  const positives = [];
  const loginIndicators = [];
  
  // Check if domain is known to require auth
  const urlObj = new URL(url);
  const isKnownAuthDomain = AUTH_REQUIRED_DOMAINS.some(d => urlObj.hostname.includes(d));
  if (isKnownAuthDomain) {
    loginIndicators.push(`Known auth domain: ${urlObj.hostname}`);
  }
  
  // Check for login/registration required patterns FIRST
  for (const pattern of LOGIN_REQUIRED_PATTERNS) {
    if (pattern.test(html)) {
      const match = html.match(pattern)?.[0] || "";
      // Clean up the match for display
      const cleanMatch = match.replace(/<[^>]+>/g, "").trim().substring(0, 50);
      if (cleanMatch) {
        loginIndicators.push(`Found: "${cleanMatch}"`);
      } else {
        loginIndicators.push(`Login pattern detected`);
      }
    }
  }
  
  // Check for redirects to login pages
  if (html.includes("login.microsoftonline.com") || 
      html.includes("login.who.int") ||
      html.includes("adfs") ||
      html.includes("saml")) {
    loginIndicators.push("Redirects to SSO/login page");
  }
  
  // If we have login indicators, this is NOT a broken link
  if (loginIndicators.length > 0) {
    return { issues: [], positives: [], loginRequired: true, loginIndicators };
  }
  
  // Check for unavailable patterns (only if not a login page)
  for (const pattern of UNAVAILABLE_PATTERNS) {
    if (pattern.test(html)) {
      issues.push(`Found: "${html.match(pattern)?.[0]}"`);
    }
  }
  
  // Check for available patterns
  for (const pattern of AVAILABLE_PATTERNS) {
    if (pattern.test(html)) {
      positives.push(`Found: "${html.match(pattern)?.[0]}"`);
    }
  }
  
  // Check page size (very small pages might be error pages)
  // But only flag if no login indicators
  const textContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (textContent.length < 500 && loginIndicators.length === 0) {
    issues.push(`Very short content (${textContent.length} chars)`);
  }
  
  // Check for empty body
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1].replace(/<[^>]+>/g, "").trim().length < 100) {
    // Don't flag empty body if it's a login redirect
    if (!html.includes("redirect") && !html.includes("location.href")) {
      issues.push("Nearly empty page body");
    }
  }
  
  // Check title for error indicators
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].toLowerCase();
    if (title.includes("404") || title.includes("not found")) {
      issues.push(`Error in title: "${titleMatch[1]}"`);
    }
    // Check if title indicates login page
    if (title.includes("sign in") || title.includes("log in") || title.includes("login")) {
      return { issues: [], positives: [], loginRequired: true, loginIndicators: [`Title: "${titleMatch[1]}"`] };
    }
  }
  
  // Platform-specific checks
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    if (html.includes("Video unavailable") || html.includes("private video")) {
      issues.push("YouTube video unavailable");
    }
  }
  
  if (url.includes("coursera.org")) {
    if (!html.includes("course-overview") && !html.includes("course-content")) {
      issues.push("Coursera course structure not found");
    }
  }
  
  if (url.includes("openwho.org")) {
    if (html.includes("course-archived") || html.includes("no longer available")) {
      issues.push("OpenWHO course archived");
    }
  }
  
  return { issues, positives, loginRequired: false, loginIndicators: [] };
}

async function checkLink(record) {
  const url = record.link;
  
  // Check modality - in-person trainings don't need a URL
  const modality = (record.modalityRaw || record.modality || "").toLowerCase();
  const isInPerson = modality.includes("person") || modality.includes("face") || modality.includes("classroom");
  const isToolkit = modality.includes("toolkit") || modality.includes("tool");
  
  if (!url) {
    // In-person or toolkit trainings without URL are fine
    if (isInPerson) {
      return {
        record,
        status: "in_person",
        error: null,
        details: ["In-person training - no URL needed"]
      };
    }
    if (isToolkit) {
      return {
        record,
        status: "toolkit",
        error: null,
        details: ["Toolkit - no URL needed"]
      };
    }
    // Online/blended without URL is a problem
    return {
      record,
      status: "warning",
      error: "No URL provided for online training",
      details: []
    };
  }
  
  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http")) {
    normalizedUrl = "https://" + normalizedUrl;
  }
  
  let lastError = null;
  
  for (let attempt = 0; attempt <= CONFIG.retries; attempt++) {
    try {
      const response = await fetchUrl(normalizedUrl);
      
      // HTTP error status
      if (response.statusCode >= 400) {
        return {
          record,
          status: "error",
          statusCode: response.statusCode,
          error: `HTTP ${response.statusCode}`,
          responseTime: response.responseTime,
          details: []
        };
      }
      
      // Analyze content
      const analysis = analyzeContent(response.body, normalizedUrl);
      
      // Determine status based on analysis
      let status = "ok";
      let error = null;
      
      // Check if login is required (separate category, NOT broken)
      if (analysis.loginRequired) {
        return {
          record,
          status: "auth_required",
          statusCode: response.statusCode,
          error: "Login/registration required",
          responseTime: response.responseTime,
          details: analysis.loginIndicators,
          positives: [],
          contentLength: response.body.length
        };
      }
      
      if (analysis.issues.length > 0 && analysis.positives.length === 0) {
        status = "error";
        error = "Content appears unavailable";
      } else if (analysis.issues.length > 0) {
        status = "warning";
        error = "Potential issues detected";
      }
      
      return {
        record,
        status,
        statusCode: response.statusCode,
        error,
        responseTime: response.responseTime,
        details: analysis.issues,
        positives: analysis.positives,
        contentLength: response.body.length
      };
      
    } catch (err) {
      lastError = err;
      if (attempt < CONFIG.retries) {
        await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
      }
    }
  }
  
  return {
    record,
    status: "error",
    error: lastError?.error || "Failed to fetch",
    responseTime: lastError?.responseTime,
    details: []
  };
}

async function runValidation(records) {
  console.log(`\n📋 Starting validation of ${records.length} training links...\n`);
  
  const results = [];
  let completed = 0;
  
  // Process in batches for concurrency
  for (let i = 0; i < records.length; i += CONFIG.concurrency) {
    const batch = records.slice(i, i + CONFIG.concurrency);
    const batchResults = await Promise.all(batch.map(checkLink));
    
    for (const result of batchResults) {
      completed++;
      let icon, statusColor;
      
      switch (result.status) {
        case "ok":
          icon = "✓";
          statusColor = "\x1b[32m"; // Green
          break;
        case "auth_required":
          icon = "🔐";
          statusColor = "\x1b[36m"; // Cyan
          break;
        case "in_person":
          icon = "👤";
          statusColor = "\x1b[35m"; // Magenta
          break;
        case "toolkit":
          icon = "🧰";
          statusColor = "\x1b[35m"; // Magenta
          break;
        case "warning":
          icon = "⚠";
          statusColor = "\x1b[33m"; // Yellow
          break;
        default:
          icon = "✗";
          statusColor = "\x1b[31m"; // Red
      }
      
      console.log(`${statusColor}${icon}\x1b[0m [${completed}/${records.length}] ${result.record.learningName.substring(0, 50)}${result.record.learningName.length > 50 ? "..." : ""}`);
      
      if (result.error) {
        console.log(`   └─ ${result.error}`);
      }
      if (result.details && result.details.length > 0 && result.status !== "auth_required") {
        result.details.forEach(d => console.log(`   └─ ${d}`));
      }
      
      results.push(result);
    }
  }
  
  return results;
}

function generateReport(results) {
  const stats = {
    total: results.length,
    ok: results.filter(r => r.status === "ok").length,
    authRequired: results.filter(r => r.status === "auth_required").length,
    inPerson: results.filter(r => r.status === "in_person").length,
    toolkit: results.filter(r => r.status === "toolkit").length,
    warning: results.filter(r => r.status === "warning").length,
    error: results.filter(r => r.status === "error" || r.status === "timeout").length
  };
  
  let report = `
================================================================================
                    WHO PHHE TRAINING LINK VALIDATION REPORT
================================================================================

Generated: ${new Date().toLocaleString()}

SUMMARY
-------
Total trainings: ${stats.total}

ONLINE TRAININGS:
  ✓ Open & verified:       ${stats.ok} (${Math.round(stats.ok/stats.total*100)}%)
  🔐 Login required:       ${stats.authRequired} (${Math.round(stats.authRequired/stats.total*100)}%)
  ⚠ Warnings:              ${stats.warning} (${Math.round(stats.warning/stats.total*100)}%)
  ✗ Broken/Unavailable:    ${stats.error} (${Math.round(stats.error/stats.total*100)}%)

NON-ONLINE (no URL needed):
  👤 In-person trainings:  ${stats.inPerson}
  🧰 Toolkits:             ${stats.toolkit}

Notes:
- "Login required" links work but need authentication
- "In-person" and "Toolkit" trainings don't require URLs

`;

  if (stats.error > 0) {
    report += `
================================================================================
                         BROKEN LINKS (${stats.error})
                    These trainings need attention!
================================================================================

`;
    results.filter(r => r.status === "error" || r.status === "timeout").forEach((r, i) => {
      report += `${i + 1}. ${r.record.learningName}
   URL: ${r.record.link}
   Error: ${r.error}
`;
      if (r.details && r.details.length > 0) {
        r.details.forEach(d => { report += `   - ${d}\n`; });
      }
      report += "\n";
    });
  }

  if (stats.warning > 0) {
    report += `
================================================================================
                              WARNINGS (${stats.warning})
================================================================================

`;
    results.filter(r => r.status === "warning").forEach((r, i) => {
      report += `${i + 1}. ${r.record.learningName}
   URL: ${r.record.link}
   Issue: ${r.error}
`;
      if (r.details && r.details.length > 0) {
        r.details.forEach(d => { report += `   - ${d}\n`; });
      }
      report += "\n";
    });
  }

  if (stats.authRequired > 0) {
    report += `
================================================================================
                    LOGIN/REGISTRATION REQUIRED (${stats.authRequired})
              These links work but require authentication to access
================================================================================

`;
    results.filter(r => r.status === "auth_required").forEach((r, i) => {
      report += `${i + 1}. ${r.record.learningName}
   URL: ${r.record.link}
`;
    });
  }

  report += `
================================================================================
                         OPEN ACCESS - WORKING (${stats.ok})
================================================================================

`;
  results.filter(r => r.status === "ok").forEach((r, i) => {
    report += `${i + 1}. ${r.record.learningName}\n`;
    if (r.positives && r.positives.length > 0) {
      report += `   Verified: ${r.positives.slice(0, 2).map(p => p.replace("Found: ", "")).join(", ")}\n`;
    }
  });

  return report;
}

// ============ MAIN ============

async function main() {
  console.log("\n🔍 WHO PHHE Training Link Validator (Deep Content Check)\n");
  
  // Get input file
  let inputFile = process.argv[2];
  
  if (!inputFile) {
    // Try to find demo-trainings.json
    const demoPath = path.join(__dirname, "../../apps/finder-ui/public/demo-trainings.json");
    if (fs.existsSync(demoPath)) {
      inputFile = demoPath;
      console.log(`Using default: ${demoPath}\n`);
    } else {
      console.error("Usage: node validate-links.js [path-to-json-or-csv]");
      process.exit(1);
    }
  }
  
  // Load data
  console.log(`📂 Loading data from: ${inputFile}`);
  const content = fs.readFileSync(inputFile, "utf8");
  
  let rawRecords;
  if (inputFile.endsWith(".json")) {
    rawRecords = JSON.parse(content);
  } else if (inputFile.endsWith(".csv")) {
    rawRecords = parseCSV(content);
  } else {
    console.error("Unsupported file format. Use .json or .csv");
    process.exit(1);
  }
  
  const records = rawRecords.map(normalizeRecord).filter(r => r.link);
  console.log(`📊 Found ${records.length} trainings with URLs\n`);
  
  // Run validation
  const results = await runValidation(records);
  
  // Generate and save report
  const report = generateReport(results);
  
  const reportPath = path.join(__dirname, `validation-report-${new Date().toISOString().split("T")[0]}.txt`);
  fs.writeFileSync(reportPath, report);
  
  console.log(`\n📄 Report saved to: ${reportPath}`);
  
  // Also save JSON results for programmatic use
  const jsonPath = path.join(__dirname, `validation-results-${new Date().toISOString().split("T")[0]}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`📊 JSON results saved to: ${jsonPath}`);
  
  // Print summary
  const stats = {
    ok: results.filter(r => r.status === "ok").length,
    authRequired: results.filter(r => r.status === "auth_required").length,
    inPerson: results.filter(r => r.status === "in_person").length,
    toolkit: results.filter(r => r.status === "toolkit").length,
    warning: results.filter(r => r.status === "warning").length,
    error: results.filter(r => r.status === "error" || r.status === "timeout").length
  };
  
  console.log(`
┌──────────────────────────────────────────┐
│            VALIDATION SUMMARY            │
├──────────────────────────────────────────┤
│  ✓ Open & working:    ${String(stats.ok).padStart(3)}                │
│  🔐 Login required:    ${String(stats.authRequired).padStart(3)}                │
│  👤 In-person:         ${String(stats.inPerson).padStart(3)}                │
│  🧰 Toolkit:           ${String(stats.toolkit).padStart(3)}                │
│  ⚠ Warnings:          ${String(stats.warning).padStart(3)}                │
│  ✗ Broken:            ${String(stats.error).padStart(3)}                │
└──────────────────────────────────────────┘

Notes:
- "Login required" links work but need authentication
- "In-person" & "Toolkit" don't need URLs
`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
