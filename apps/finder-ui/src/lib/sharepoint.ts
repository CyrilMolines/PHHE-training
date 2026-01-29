import type { TrainingRecord } from "./schema";
import { normalizeRow } from "./normalize";

export interface SharePointListConfig {
  /**
   * Example: "/sites/EuroWCPHE" or "" for root site.
   * When hosted inside SharePoint, this should match the site that contains the COPY list.
   */
  siteRelativeUrl: string;
  listTitle: string;
}

const FIELDS = [
  "Learning_x0020_Name",
  "field_2",
  "Description",
  "field_3",
  "Technical_x0020_area",
  "field_4",
  "Focus_x0020_area",
  "field_8",
  "Intended_x0020_audience",
  "field_11",
  "Owner",
  "field_5",
  "Developer",
  "field_7",
  "Contact_x0020_details",
  "field_6",
  "Language",
  "field_9",
  "Modality",
  "field_12",
  "Platform",
  "field_10",
  "Link",
  "field_14",
  "Comment",
  "field_17",
  "_Flow_SignoffStatus"
];

function spUrl(config: SharePointListConfig, apiPath: string): string {
  const base = config.siteRelativeUrl ? config.siteRelativeUrl.replace(/\/+$/, "") : "";
  return `${base}${apiPath}`;
}

function mapItemToCsvHeaderShape(item: Record<string, unknown>): Record<string, string> {
  const get = (key: string): string => {
    const v = item[key];
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    return String(v);
  };

  // The CSV export used friendly display names; the list uses internal names.
  // We map to the CSV header keys so the rest of the pipeline stays consistent.
  return {
    "Learning Name": get("field_2"),
    Description: get("field_3"),
    "Technical area": get("field_4"),
    "Focus area": get("field_8"),
    "Intended audience": get("field_11"),
    Owner: get("field_5"),
    Developer: get("field_7"),
    "Contact details": get("field_6"),
    Language: get("field_9"),
    Modality: get("field_12"),
    Platform: get("field_10"),
    Link: get("field_14"),
    Comment: get("field_17"),
    "Sign-off status": get("_Flow_SignoffStatus")
  };
}

type SPItemsResponse = {
  value?: Array<Record<string, unknown>>;
  "odata.nextLink"?: string;
  "@odata.nextLink"?: string;
};

async function spFetchJson(url: string): Promise<SPItemsResponse> {
  const r = await fetch(url, {
    headers: {
      Accept: "application/json;odata=nometadata"
    },
    credentials: "same-origin"
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`SharePoint REST error ${r.status} ${r.statusText}: ${text.slice(0, 500)}`);
  }
  return (await r.json()) as SPItemsResponse;
}

export async function fetchAllListItems(config: SharePointListConfig): Promise<TrainingRecord[]> {
  // Use REST; supports page-embedded static UI with SSO cookies.
  const select = [
    "Id",
    "field_2",
    "field_3",
    "field_4",
    "field_5",
    "field_6",
    "field_7",
    "field_8",
    "field_9",
    "field_10",
    "field_11",
    "field_12",
    "field_14",
    "field_17",
    "_Flow_SignoffStatus"
  ].join(",");

  let url = spUrl(
    config,
    `/_api/web/lists/getbytitle('${encodeURIComponent(config.listTitle)}')/items?$select=${select}&$top=5000`
  );

  const out: TrainingRecord[] = [];
  while (url) {
    const data = await spFetchJson(url);
    const items = data.value ?? [];
    for (const item of items) {
      const shaped = mapItemToCsvHeaderShape(item);
      const rec = await normalizeRow(shaped);
      out.push(rec);
    }
    url = (data["@odata.nextLink"] || data["odata.nextLink"] || "") as string;
  }

  return out;
}

