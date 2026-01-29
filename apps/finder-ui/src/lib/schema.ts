export type Modality = "online" | "in_person" | "blended" | "toolkit" | "unknown";

export interface TrainingRecord {
  id: string;
  sourceRow?: number;

  learningName: string;
  description: string;
  technicalArea: string;
  focusArea: string;
  intendedAudience: string;
  owner: string;
  developer: string;
  contactDetails: string;
  languages: string[];
  modalityRaw: string;
  modality: Modality;
  platform: string;
  link: string;
  comment: string;
  signoffStatus: string;

  normalizedLink: string;
  searchText: string;
}

export interface RankedTraining {
  record: TrainingRecord;
  score: number;
  reasons: string[];
}

