#!/usr/bin/env node
/**
 * WHO PHHE SharePoint to GitHub Sync
 * 
 * Fetches training list from SharePoint and pushes to GitHub.
 * Uses device code flow for authentication (you log in via browser once).
 * 
 * Usage:
 *   node sync-to-github.js
 * 
 * First run will prompt you to authenticate via browser.
 * Token is cached for subsequent runs.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ============ CONFIGURATION ============
const CONFIG = {
  // SharePoint settings
  sharepoint: {
    tenantId: "worldhealthorg.onmicrosoft.com",
    siteHost: "worldhealthorg.sharepoint.com",
    sitePath: "/sites/EuroWCPHE",
    listTitle: "Copytraininglist2912026"  // Your test list
  },
  
  // GitHub settings
  github: {
    repo: "CyrilMolines/PHHE-training",
    branch: "main",
    filePath: "demo-trainings.json"
  },
  
  // Azure AD App (Microsoft Graph)
  // Using the well-known "Microsoft Graph PowerShell" app for device code flow
  azureAd: {
    clientId: "14d82eec-204b-4c2f-b7e8-296a70dab67e",  // Graph PowerShell public client
    scope: "https://graph.microsoft.com/.default offline_access"
  },
  
  // Local paths
  tokenCachePath: path.join(__dirname, ".token-cache.json"),
  outputPath: path.join(__dirname, "../../apps/finder-ui/public/demo-trainings.json")
};

// ============ AUTHENTICATION ============

async function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function getDeviceCode() {
  const postData = new URLSearchParams({
    client_id: CONFIG.azureAd.clientId,
    scope: CONFIG.azureAd.scope
  }).toString();

  const response = await httpRequest({
    hostname: "login.microsoftonline.com",
    path: `/${CONFIG.sharepoint.tenantId}/oauth2/v2.0/devicecode`,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(postData)
    }
  }, postData);

  if (response.status !== 200) {
    throw new Error(`Device code request failed: ${JSON.stringify(response.data)}`);
  }

  return response.data;
}

async function pollForToken(deviceCode) {
  const postData = new URLSearchParams({
    client_id: CONFIG.azureAd.clientId,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    device_code: deviceCode.device_code
  }).toString();

  const interval = deviceCode.interval || 5;
  const expiresAt = Date.now() + (deviceCode.expires_in * 1000);

  while (Date.now() < expiresAt) {
    await new Promise(r => setTimeout(r, interval * 1000));

    const response = await httpRequest({
      hostname: "login.microsoftonline.com",
      path: `/${CONFIG.sharepoint.tenantId}/oauth2/v2.0/token`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData)
      }
    }, postData);

    if (response.status === 200) {
      return response.data;
    }

    if (response.data.error === "authorization_pending") {
      process.stdout.write(".");
      continue;
    }

    if (response.data.error === "slow_down") {
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    throw new Error(`Token request failed: ${response.data.error_description || response.data.error}`);
  }

  throw new Error("Authentication timed out");
}

async function refreshToken(refreshToken) {
  const postData = new URLSearchParams({
    client_id: CONFIG.azureAd.clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: CONFIG.azureAd.scope
  }).toString();

  const response = await httpRequest({
    hostname: "login.microsoftonline.com",
    path: `/${CONFIG.sharepoint.tenantId}/oauth2/v2.0/token`,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(postData)
    }
  }, postData);

  if (response.status !== 200) {
    throw new Error(`Token refresh failed: ${JSON.stringify(response.data)}`);
  }

  return response.data;
}

async function getAccessToken() {
  // Check for cached token
  if (fs.existsSync(CONFIG.tokenCachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CONFIG.tokenCachePath, "utf8"));
      
      // Check if token is still valid (with 5 min buffer)
      if (cached.expires_at && cached.expires_at > Date.now() + 300000) {
        console.log("✓ Using cached access token");
        return cached.access_token;
      }
      
      // Try to refresh
      if (cached.refresh_token) {
        console.log("↻ Refreshing access token...");
        const tokens = await refreshToken(cached.refresh_token);
        saveTokenCache(tokens);
        return tokens.access_token;
      }
    } catch (e) {
      console.log("⚠ Cached token invalid, re-authenticating...");
    }
  }

  // Need fresh authentication
  console.log("\n🔐 Authentication required\n");
  const deviceCode = await getDeviceCode();
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`\n  1. Open: ${deviceCode.verification_uri}`);
  console.log(`  2. Enter code: ${deviceCode.user_code}\n`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\nWaiting for authentication");

  const tokens = await pollForToken(deviceCode);
  saveTokenCache(tokens);
  console.log("\n✓ Authentication successful!\n");
  
  return tokens.access_token;
}

function saveTokenCache(tokens) {
  const cache = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + (tokens.expires_in * 1000)
  };
  fs.writeFileSync(CONFIG.tokenCachePath, JSON.stringify(cache, null, 2));
}

// ============ SHAREPOINT ============

async function getSharePointSiteId(accessToken) {
  const response = await httpRequest({
    hostname: "graph.microsoft.com",
    path: `/v1.0/sites/${CONFIG.sharepoint.siteHost}:${CONFIG.sharepoint.sitePath}`,
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json"
    }
  });

  if (response.status !== 200) {
    throw new Error(`Failed to get site: ${JSON.stringify(response.data)}`);
  }

  return response.data.id;
}

async function getListId(accessToken, siteId) {
  const response = await httpRequest({
    hostname: "graph.microsoft.com",
    path: `/v1.0/sites/${siteId}/lists?$filter=displayName eq '${encodeURIComponent(CONFIG.sharepoint.listTitle)}'`,
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json"
    }
  });

  if (response.status !== 200) {
    throw new Error(`Failed to get lists: ${JSON.stringify(response.data)}`);
  }

  if (!response.data.value || response.data.value.length === 0) {
    throw new Error(`List "${CONFIG.sharepoint.listTitle}" not found`);
  }

  return response.data.value[0].id;
}

async function getListItems(accessToken, siteId, listId) {
  const allItems = [];
  let nextLink = `/v1.0/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=100`;

  while (nextLink) {
    const isFullUrl = nextLink.startsWith("https://");
    const hostname = isFullUrl ? new URL(nextLink).hostname : "graph.microsoft.com";
    const urlPath = isFullUrl ? new URL(nextLink).pathname + new URL(nextLink).search : nextLink;

    const response = await httpRequest({
      hostname,
      path: urlPath,
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json"
      }
    });

    if (response.status !== 200) {
      throw new Error(`Failed to get items: ${JSON.stringify(response.data)}`);
    }

    allItems.push(...response.data.value);
    nextLink = response.data["@odata.nextLink"] || null;
  }

  return allItems;
}

// ============ DATA TRANSFORMATION ============

function normalizeModality(raw) {
  const lower = (raw || "").toLowerCase();
  if (lower.includes("online") && lower.includes("person")) return "blended";
  if (lower.includes("online")) return "online";
  if (lower.includes("person") || lower.includes("face")) return "in_person";
  if (lower.includes("toolkit") || lower.includes("tool")) return "toolkit";
  return "unknown";
}

function normalizeLink(raw) {
  if (!raw) return "";
  let url = raw.trim();
  if (url && !url.startsWith("http")) {
    url = "https://" + url;
  }
  return url;
}

function parseLanguages(raw) {
  if (!raw) return [];
  return raw.split(/[,;\/]/).map(s => s.trim()).filter(Boolean);
}

function transformItem(item, index) {
  const f = item.fields || {};
  
  const record = {
    id: `training-${index + 1}`,
    sourceRow: index + 1,
    learningName: f.Title || f.LearningName || "",
    description: f.Description || "",
    technicalArea: f.TechnicalArea || "",
    focusArea: f.FocusArea || "",
    intendedAudience: f.IntendedAudience || "",
    owner: f.Owner || "",
    developer: f.Developer || "",
    contactDetails: f.ContactDetails || "",
    languages: parseLanguages(f.Language_x0028_s_x0029_ || f.Languages || ""),
    modalityRaw: f.Modality || "",
    platform: f.Platform || "",
    link: f.Link || "",
    comment: f.Comment || "",
    signoffStatus: f.Sign_x002d_offStatus || f.SignoffStatus || ""
  };
  
  record.modality = normalizeModality(record.modalityRaw);
  record.normalizedLink = normalizeLink(record.link);
  record.searchText = [
    record.learningName,
    record.description,
    record.technicalArea,
    record.focusArea,
    record.intendedAudience,
    ...record.languages
  ].filter(Boolean).join(" ").toLowerCase();
  
  return record;
}

// ============ GITHUB ============

function pushToGitHub(jsonPath) {
  const distPath = path.join(__dirname, "../../apps/finder-ui/dist-embed");
  
  console.log("\n📤 Pushing to GitHub...\n");
  
  try {
    // Copy to dist-embed for GitHub Pages
    const destPath = path.join(distPath, "demo-trainings.json");
    fs.copyFileSync(jsonPath, destPath);
    
    // Also copy to validator and discovery folders
    fs.copyFileSync(jsonPath, path.join(distPath, "validator", "demo-trainings.json"));
    fs.copyFileSync(jsonPath, path.join(distPath, "discovery", "demo-trainings.json"));
    
    // Git operations
    execSync("git add -A", { cwd: distPath, stdio: "pipe" });
    
    const status = execSync("git status --porcelain", { cwd: distPath, encoding: "utf8" });
    if (!status.trim()) {
      console.log("✓ No changes to push (data unchanged)");
      return false;
    }
    
    const commitMsg = `Update training data - ${new Date().toISOString().split("T")[0]}`;
    execSync(`git commit -m "${commitMsg}"`, { cwd: distPath, stdio: "pipe" });
    execSync("git push", { cwd: distPath, stdio: "inherit" });
    
    console.log("✓ Successfully pushed to GitHub!");
    console.log(`  Changes will be live at https://cyrilmolines.github.io/PHHE-training/ in ~2 minutes`);
    return true;
    
  } catch (e) {
    console.error("✗ Failed to push to GitHub:", e.message);
    console.log("  You may need to push manually or check git credentials.");
    return false;
  }
}

// ============ MAIN ============

async function main() {
  console.log("\n🔄 WHO PHHE SharePoint → GitHub Sync\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Source: ${CONFIG.sharepoint.siteHost}${CONFIG.sharepoint.sitePath}`);
  console.log(`  List:   ${CONFIG.sharepoint.listTitle}`);
  console.log(`  Target: github.com/${CONFIG.github.repo}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  try {
    // Authenticate
    const accessToken = await getAccessToken();
    
    // Get SharePoint data
    console.log("📥 Fetching SharePoint list...");
    const siteId = await getSharePointSiteId(accessToken);
    const listId = await getListId(accessToken, siteId);
    const items = await getListItems(accessToken, siteId, listId);
    
    console.log(`   Found ${items.length} training records\n`);
    
    // Transform data
    console.log("🔄 Transforming data...");
    const records = items.map(transformItem);
    
    // Save JSON
    const jsonContent = JSON.stringify(records, null, 2);
    fs.writeFileSync(CONFIG.outputPath, jsonContent);
    console.log(`   Saved to: ${CONFIG.outputPath}\n`);
    
    // Push to GitHub
    const pushed = pushToGitHub(CONFIG.outputPath);
    
    // Summary
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("                        SYNC COMPLETE");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  ✓ ${records.length} trainings exported`);
    if (pushed) {
      console.log(`  ✓ Pushed to GitHub`);
    } else {
      console.log(`  ○ GitHub push skipped (no changes or manual push needed)`);
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
  } catch (e) {
    console.error("\n✗ Error:", e.message);
    process.exit(1);
  }
}

main();
