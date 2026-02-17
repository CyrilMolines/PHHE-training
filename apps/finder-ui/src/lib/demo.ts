import type { TrainingRecord } from "./schema";

const GITHUB_REPO = "CyrilMolines/PHHE-training";
const GITHUB_REF = "gh-pages";
const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_REF}`;
const API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;

/** Detect if we're on the PHHE-training GitHub Pages site so we can use "latest JSON" from the repo. */
function isOnPHHEGitHubPages(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const origin = window.location.origin ?? "";
    const pathname = window.location.pathname ?? "";
    return (
      (origin.includes("github.io") && pathname.includes("PHHE-training")) ||
      (origin.includes("github.io") && pathname.includes("training"))
    );
  } catch {
    return false;
  }
}

/** Fetch the most recently committed .json file from the repo and load it. Falls back to demo-trainings.json on failure. */
async function loadLatestJsonFromGitHub(): Promise<TrainingRecord[] | null> {
  try {
    const listRes = await fetch(`${API_BASE}/contents?ref=${GITHUB_REF}`, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!listRes.ok) return null;
    const list = (await listRes.json()) as Array<{ name: string; path: string; type: string }>;
    const jsonFiles = list.filter((f) => f.type === "file" && f.name.endsWith(".json"));
    if (jsonFiles.length === 0) return null;

    let latestPath: string | null = null;
    let latestDate = 0;

    for (const f of jsonFiles) {
      const commitRes = await fetch(
        `${API_BASE}/commits?path=${encodeURIComponent(f.path)}&sha=${GITHUB_REF}&per_page=1`,
        { headers: { Accept: "application/vnd.github.v3+json" } }
      );
      if (!commitRes.ok) continue;
      const commits = (await commitRes.json()) as Array<{ commit?: { author?: { date?: string } } }>;
      const dateStr = commits[0]?.commit?.author?.date;
      if (!dateStr) continue;
      const t = new Date(dateStr).getTime();
      if (t > latestDate) {
        latestDate = t;
        latestPath = f.path;
      }
    }

    if (!latestPath) return null;

    const rawRes = await fetch(`${RAW_BASE}/${encodeURIComponent(latestPath)}`, {
      credentials: "omit",
    });
    if (!rawRes.ok) return null;
    const data = (await rawRes.json()) as unknown;
    if (!Array.isArray(data)) return null;
    return data as TrainingRecord[];
  } catch {
    return null;
  }
}

export async function loadDemoTrainings(): Promise<TrainingRecord[]> {
  if (isOnPHHEGitHubPages()) {
    const fromGitHub = await loadLatestJsonFromGitHub();
    if (fromGitHub != null) return fromGitHub;
  }

  const r = await fetch("./demo-trainings.json", { credentials: "same-origin" });
  if (!r.ok) throw new Error(`Failed to load demo-trainings.json (${r.status})`);
  const data = (await r.json()) as unknown;
  if (!Array.isArray(data)) throw new Error("demo-trainings.json is not an array");
  return data as TrainingRecord[];
}
