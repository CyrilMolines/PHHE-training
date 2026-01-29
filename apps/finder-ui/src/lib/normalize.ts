import type { Modality, TrainingRecord } from "./schema";

function cleanText(s: string): string {
  return s.replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ");
}

function splitCsvList(s: string): string[] {
  const v = cleanText(s);
  if (!v) return [];
  return v
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function normalizeModality(raw: string): Modality {
  const v = cleanText(raw).toLowerCase();
  if (!v) return "unknown";
  if (v === "online" || v === "e-learning" || v === "elearning") return "online";
  if (v === "in-person" || v === "in person" || v === "inperson") return "in_person";
  if (v === "blended") return "blended";
  if (v === "training toolkits and packages" || v === "toolkit" || v === "toolkits")
    return "toolkit";
  return "unknown";
}

export async function stableIdFromText(text: string): Promise<string> {
  // Stable deterministic ID derived from the training title+link.
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 24);
}

export async function normalizeRow(
  row: Record<string, string | undefined>,
  sourceRow?: number
): Promise<TrainingRecord> {
  const learningName = cleanText(row["Learning Name"] ?? "");
  const description = cleanText(row["Description"] ?? "");
  const technicalArea = cleanText(row["Technical area"] ?? "");
  const focusArea = cleanText(row["Focus area"] ?? "");
  const intendedAudience = cleanText(row["Intended audience"] ?? "");
  const owner = cleanText(row["Owner"] ?? "");
  const developer = cleanText(row["Developer"] ?? "");
  const contactDetails = cleanText(row["Contact details"] ?? "");
  const languages = splitCsvList(row["Language"] ?? "");
  const modalityRaw = row["Modality"] ?? "";
  const modality = normalizeModality(modalityRaw);
  const platform = cleanText(row["Platform"] ?? "");
  const link = cleanText(row["Link"] ?? "");
  const comment = cleanText(row["Comment"] ?? "");
  const signoffStatus = cleanText(row["Sign-off status"] ?? "");

  const normalizedLink = cleanText(link.replace(/&amp;/g, "&"));

  const searchText = [
    learningName,
    description,
    technicalArea,
    focusArea,
    intendedAudience,
    owner,
    developer,
    contactDetails,
    languages.join(", "),
    platform,
    normalizedLink
  ]
    .join(" | ")
    .toLowerCase();

  const id = await stableIdFromText(`${learningName}||${normalizedLink}`);

  return {
    id,
    sourceRow,
    learningName,
    description,
    technicalArea,
    focusArea,
    intendedAudience,
    owner,
    developer,
    contactDetails,
    languages,
    modalityRaw: cleanText(modalityRaw),
    modality,
    platform,
    link,
    comment,
    signoffStatus,
    normalizedLink,
    searchText
  };
}

