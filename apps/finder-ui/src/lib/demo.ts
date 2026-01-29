import type { TrainingRecord } from "./schema";

export async function loadDemoTrainings(): Promise<TrainingRecord[]> {
  const r = await fetch("./demo-trainings.json", { credentials: "same-origin" });
  if (!r.ok) throw new Error(`Failed to load demo-trainings.json (${r.status})`);
  const data = (await r.json()) as unknown;
  if (!Array.isArray(data)) throw new Error("demo-trainings.json is not an array");
  return data as TrainingRecord[];
}

