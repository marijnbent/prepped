import { createGoogleGenerativeAI } from "@ai-sdk/google";

export class AIConfigError extends Error {
  code: "AI_CONFIG_MISSING_API_KEY";

  constructor(message: string) {
    super(message);
    this.name = "AIConfigError";
    this.code = "AI_CONFIG_MISSING_API_KEY";
  }
}

let _google: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function resolveGeminiApiKey() {
  const apiKey = (import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new AIConfigError("GEMINI_API_KEY is not configured");
  }
  return apiKey;
}

function getGoogle() {
  if (!_google) {
    _google = createGoogleGenerativeAI({
      apiKey: resolveGeminiApiKey(),
    });
  }
  return _google;
}

export function getChatModel() {
  return getGoogle()("gemini-3-flash-preview");
}
