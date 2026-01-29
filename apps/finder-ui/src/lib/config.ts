export interface AppConfig {
  dataSource: "sharepoint" | "demo_json";
  siteRelativeUrl: string;
  listTitle: string;
  enableEmbeddings: boolean;
  /**
   * Path relative to the built app root (example: "./models").
   * The model folder should be deployed under this directory.
   */
  modelsBasePath: string;
  /**
   * Default false to avoid external downloads.
   * If true, transformers.js may fetch models remotely.
   */
  allowRemoteModels: boolean;
}

const STORAGE_KEY = "whoTrainingFinder.config.v1";

export function defaultConfig(): AppConfig {
  const siteRelativeUrl = guessSiteRelativeUrl();
  return {
    dataSource: "sharepoint",
    siteRelativeUrl,
    listTitle: "WHO training on humanitarian and health emergencie",
    enableEmbeddings: true,
    modelsBasePath: "./models",
    allowRemoteModels: false
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

