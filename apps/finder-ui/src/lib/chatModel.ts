import { env, pipeline } from "@huggingface/transformers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _chatPipe: any = null;

export interface ChatModelConfig {
  modelsBasePath: string;
  allowRemoteModels: boolean;
}

// SmolLM-135M-Instruct for lightweight conversational AI
const CHAT_MODEL_ID = "HuggingFaceTB/SmolLM-135M-Instruct";

function normalizeBasePath(p: string): string {
  const v = p.trim();
  if (!v) return "./models";
  return v.replace(/\/+$/, "");
}

export async function loadChatModel(cfg: ChatModelConfig): Promise<typeof _chatPipe> {
  if (_chatPipe) return _chatPipe;

  // When allowRemoteModels is true, disable local models to avoid 404 errors
  env.allowLocalModels = !cfg.allowRemoteModels;
  env.allowRemoteModels = cfg.allowRemoteModels;
  
  if (!cfg.allowRemoteModels) {
    env.localModelPath = normalizeBasePath(cfg.modelsBasePath);
  }

  console.log(`[ChatModel] Loading SmolLM-135M-Instruct...`);
  const startTime = performance.now();

  _chatPipe = await pipeline("text-generation", CHAT_MODEL_ID, {
    dtype: "fp32",
    progress_callback: (progress: { status: string; progress?: number }) => {
      if (progress.progress !== undefined) {
        console.log(`[ChatModel] ${progress.status}: ${Math.round(progress.progress)}%`);
      }
    }
  });

  console.log(`[ChatModel] Model loaded in ${Math.round(performance.now() - startTime)}ms`);
  return _chatPipe;
}

export interface ExtractedIntent {
  topic: string;
  language?: string;
  modality?: "online" | "in_person" | "blended";
  platform?: string;
  audience?: string;
  rawQuery: string;
}

export interface TrainingSummary {
  name: string;
  description: string;
  technicalArea: string;
  focusArea: string;
  platform: string;
  languages: string[];
  modality: string;
}

/**
 * Use SmolLM to extract structured intent from user query
 */
export async function extractIntent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pipe: any,
  userQuery: string
): Promise<ExtractedIntent> {
  const prompt = `<|im_start|>system
You extract training search parameters from user queries.
IMPORTANT: The "topic" field should contain ONLY the subject matter (like "emergency response", "cholera", "infection prevention"), NOT filters like language, modality, or platform.
Extract: topic (subject only), language, modality (online/in-person/blended), platform, audience.
Respond with JSON only.
<|im_end|>
<|im_start|>user
Query: "${userQuery}"
<|im_end|>
<|im_start|>assistant
{`;

  try {
    const result = await pipe(prompt, {
      max_new_tokens: 150,
      temperature: 0.1,
      do_sample: false,
      return_full_text: false
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = "{" + ((result as any)[0]?.generated_text || "").split("}")[0] + "}";
    
    try {
      const parsed = JSON.parse(text);
      return {
        topic: parsed.topic || userQuery,
        language: parsed.language,
        modality: parsed.modality,
        platform: parsed.platform,
        audience: parsed.audience,
        rawQuery: userQuery
      };
    } catch {
      // If JSON parsing fails, fall back to basic extraction
      return fallbackExtractIntent(userQuery);
    }
  } catch (e) {
    console.warn("[ChatModel] Intent extraction failed, using fallback:", e);
    return fallbackExtractIntent(userQuery);
  }
}

/**
 * Fallback regex-based intent extraction
 * Extracts topic (the subject matter) separately from filters (language, modality, platform)
 */
function fallbackExtractIntent(query: string): ExtractedIntent {
  const t = query.toLowerCase();
  let topic = query;
  
  const intent: ExtractedIntent = {
    topic: query,
    rawQuery: query
  };

  // Extract and remove language from topic
  const languages = ["english", "french", "spanish", "russian", "arabic", "portuguese", "chinese", "ukrainian", "polish"];
  for (const lang of languages) {
    const langPattern = new RegExp(`\\b(in\\s+)?${lang}\\b`, "gi");
    if (langPattern.test(t)) {
      intent.language = lang.charAt(0).toUpperCase() + lang.slice(1);
      topic = topic.replace(langPattern, "");
      break;
    }
  }

  // Extract and remove modality from topic
  if (/\bonline\b|e-learning|elearning/i.test(t)) {
    intent.modality = "online";
    topic = topic.replace(/\bonline\b|e-learning|elearning/gi, "");
  } else if (/\bin[- ]person\b|face[- ]to[- ]face/i.test(t)) {
    intent.modality = "in_person";
    topic = topic.replace(/\bin[- ]person\b|face[- ]to[- ]face/gi, "");
  } else if (/\bblended\b|hybrid/i.test(t)) {
    intent.modality = "blended";
    topic = topic.replace(/\bblended\b|hybrid/gi, "");
  }

  // Extract and remove platform from topic
  if (/openwho/i.test(t)) {
    intent.platform = "OpenWHO";
    topic = topic.replace(/openwho/gi, "");
  } else if (/who academy/i.test(t)) {
    intent.platform = "WHO Academy";
    topic = topic.replace(/who academy/gi, "");
  } else if (/hslp/i.test(t)) {
    intent.platform = "HSLP";
    topic = topic.replace(/hslp/gi, "");
  } else if (/goarn/i.test(t)) {
    intent.platform = "GOARN";
    topic = topic.replace(/goarn/gi, "");
  }

  // Extract audience (don't remove from topic as it might be relevant)
  if (/member state|ministry|moh\b/i.test(t)) intent.audience = "Member";
  else if (/who staff/i.test(t)) intent.audience = "WHO";

  // Clean up topic: remove filler words and extra whitespace
  topic = topic
    .replace(/\b(i need|i want|i'm looking for|looking for|find me|show me|a training|training|about|on|for)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  
  // If topic is empty after cleaning, use a generic search term
  intent.topic = topic || "health emergency";

  return intent;
}

/**
 * Generate a natural language response summarizing search results
 */
export async function generateResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pipe: any,
  intent: ExtractedIntent,
  trainings: TrainingSummary[],
  totalMatches: number
): Promise<string> {
  if (trainings.length === 0) {
    return generateNoResultsResponse(intent);
  }

  const topTrainings = trainings.slice(0, 3).map((t, i) => 
    `${i + 1}. "${t.name}" (${t.platform || "Various"}, ${t.languages.join(", ") || "Multiple languages"})`
  ).join("\n");

  const filtersUsed = [];
  if (intent.language) filtersUsed.push(`language: ${intent.language}`);
  if (intent.modality) filtersUsed.push(`modality: ${intent.modality}`);
  if (intent.platform) filtersUsed.push(`platform: ${intent.platform}`);

  const prompt = `<|im_start|>system
You are a helpful training advisor. Summarize search results in 2-3 friendly sentences.
<|im_end|>
<|im_start|>user
User searched for: "${intent.topic}"
${filtersUsed.length ? `Filters: ${filtersUsed.join(", ")}` : ""}
Found ${totalMatches} matching trainings. Top results:
${topTrainings}

Write a brief, helpful response:
<|im_end|>
<|im_start|>assistant
`;

  try {
    const result = await pipe(prompt, {
      max_new_tokens: 100,
      temperature: 0.7,
      do_sample: true,
      return_full_text: false
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = ((result as any)[0]?.generated_text || "").trim();
    
    if (text && text.length > 20) {
      return text;
    }
  } catch (e) {
    console.warn("[ChatModel] Response generation failed:", e);
  }

  // Fallback to template response
  return generateTemplateResponse(intent, trainings, totalMatches);
}

function generateNoResultsResponse(intent: ExtractedIntent): string {
  const filters = [];
  if (intent.language) filters.push(`in ${intent.language}`);
  if (intent.modality) filters.push(intent.modality.replace("_", "-"));
  if (intent.platform) filters.push(`on ${intent.platform}`);
  
  const filterStr = filters.length ? ` ${filters.join(", ")}` : "";
  return `I couldn't find any trainings matching "${intent.topic}"${filterStr}. Try broadening your search or removing some filters.`;
}

function generateTemplateResponse(
  intent: ExtractedIntent,
  trainings: TrainingSummary[],
  totalMatches: number
): string {
  const filters = [];
  if (intent.language) filters.push(`in ${intent.language}`);
  if (intent.modality) filters.push(intent.modality.replace("_", "-"));
  if (intent.platform) filters.push(`on ${intent.platform}`);
  
  const filterStr = filters.length ? ` (${filters.join(", ")})` : "";
  const topName = trainings[0]?.name || "relevant training";
  
  return `I found ${totalMatches} training(s) related to "${intent.topic}"${filterStr}. The top match is "${topName}". ${totalMatches > 1 ? "Check out the results below for more options." : ""}`;
}

/**
 * Check if chat model is loaded
 */
export function isChatModelLoaded(): boolean {
  return _chatPipe !== null;
}

/**
 * Get chat model info
 */
export function getChatModelInfo(): { name: string; size: string; capability: string } {
  return {
    name: "SmolLM-135M-Instruct",
    size: "~270MB",
    capability: "Conversational AI, intent extraction, response generation"
  };
}
