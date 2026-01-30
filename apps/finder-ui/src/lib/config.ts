export interface AppConfig {
  dataSource: "sharepoint" | "demo_json";
  siteRelativeUrl: string;
  listTitle: string;
  
  // Embedding model settings
  enableEmbeddings: boolean;
  embeddingModel: "minilm" | "bge-small" | "gte-small";
  
  // Chat model settings  
  enableChatModel: boolean;
  
  // Model loading settings
  modelsBasePath: string;
  allowRemoteModels: boolean;
}

const STORAGE_KEY = "whoTrainingFinder.config.v2";

export function defaultConfig(): AppConfig {
  const siteRelativeUrl = guessSiteRelativeUrl();
  return {
    dataSource: "demo_json", // Default to demo for standalone hosting
    siteRelativeUrl,
    listTitle: "Copytraininglist2912026",
    
    enableEmbeddings: true,
    embeddingModel: "bge-small", // Better quality default
    
    enableChatModel: true, // Enable conversational AI
    
    modelsBasePath: "./models",
    allowRemoteModels: true // Allow downloading models from HuggingFace
  };
}

function guessSiteRelativeUrl(): string {
  // If hosted on a SharePoint site, path is typically:
  //   /sites/SiteName/SitePages/Page.aspx
  //   /sites/SiteName/Shared%20Documents/...
  const path = window.location.pathname || "/";
  const parts = path.split("/").filter(Boolean);
  const sitesIdx = parts.indexOf("sites");
  if (sitesIdx >= 0 && parts.length >= sitesIdx + 2) {
    return `/${["sites", parts[sitesIdx + 1]].join("/")}`;
  }
  return "";
}

export function loadConfig(): AppConfig {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultConfig();
  try {
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return { ...defaultConfig(), ...parsed };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(cfg: AppConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function getModelSizes(): { embeddings: string; chat: string; total: string } {
  const embeddingSizes = {
    "minilm": 23,
    "bge-small": 130,
    "gte-small": 67
  };
  
  const embSize = embeddingSizes["bge-small"]; // Default
  const chatSize = 270; // SmolLM-135M
  
  return {
    embeddings: `~${embSize}MB`,
    chat: `~${chatSize}MB`,
    total: `~${embSize + chatSize}MB`
  };
}
