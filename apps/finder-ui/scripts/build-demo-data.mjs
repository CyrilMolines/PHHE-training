import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Papa from "papaparse";
import { fileURLToPath } from "node:url";

function cleanText(s) {
  return String(s ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function splitCsvList(s) {
  const v = cleanText(s);
  if (!v) return [];
  return v
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

function normalizeModality(raw) {
  const v = cleanText(raw).toLowerCase();
  if (!v) return "unknown";
  if (v === "online" || v === "e-learning" || v === "elearning") return "online";
  if (v === "in-person" || v === "in person" || v === "inperson") return "in_person";
  if (v === "blended") return "blended";
  if (v === "training toolkits and packages" || v === "toolkit" || v === "toolkits") return "toolkit";
  return "unknown";
}

function stableIdFromText(text) {
  const hex = crypto.createHash("sha256").update(text, "utf8").digest("hex");
  return hex.slice(0, 24);
}

function stripListSchemaPreamble(raw) {
  const lines = raw.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.trim().startsWith('"Learning Name"'));
  if (idx < 0) return raw;
  return lines.slice(idx).join("\n");
}

function normalizeRow(row, sourceRow) {
  const learningName = cleanText(row["Learning Name"]);
  const description = cleanText(row["Description"]);
  const technicalArea = cleanText(row["Technical area"]);
  const focusArea = cleanText(row["Focus area"]);
  const intendedAudience = cleanText(row["Intended audience"]);
  const owner = cleanText(row["Owner"]);
  const developer = cleanText(row["Developer"]);
  const contactDetails = cleanText(row["Contact details"]);
  const languages = splitCsvList(row["Language"]);
  const modalityRaw = row["Modality"] ?? "";
  const modality = normalizeModality(modalityRaw);
  const platform = cleanText(row["Platform"]);
  const link = cleanText(row["Link"]);
  const comment = cleanText(row["Comment"]);
  const signoffStatus = cleanText(row["Sign-off status"]);

  const normalizedLink = cleanText(String(link).replace(/&amp;/g, "&"));
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
  const id = stableIdFromText(`${learningName}||${normalizedLink}`);

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

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const csvPath = path.join(repoRoot, "WHO Europe Humanitarian and Health Emergencies Training List.csv");
const outPath = path.join(repoRoot, "apps", "finder-ui", "public", "demo-trainings.json");

const raw = fs.readFileSync(csvPath, "utf8");
const csvText = stripListSchemaPreamble(raw);

const parsed = Papa.parse(csvText, {
  header: true,
  skipEmptyLines: true
});

if (parsed.errors && parsed.errors.length) {
  console.error(parsed.errors.slice(0, 5));
  process.exitCode = 1;
  throw new Error(`CSV parse errors: ${parsed.errors.length}`);
}

const records = [];
for (let i = 0; i < parsed.data.length; i++) {
  const row = parsed.data[i];
  const rec = normalizeRow(row, i + 1);
  if (!rec.learningName && !rec.normalizedLink) continue;
  records.push(rec);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(records, null, 2), "utf8");
console.log(`Wrote ${records.length} records to ${outPath}`);

