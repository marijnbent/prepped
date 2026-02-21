import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export class AIConfigError extends Error {
  code: "AI_CONFIG_MISSING_API_KEY";

  constructor(message: string) {
    super(message);
    this.name = "AIConfigError";
    this.code = "AI_CONFIG_MISSING_API_KEY";
  }
}

let _google: ReturnType<typeof createGoogleGenerativeAI> | null = null;
let _openrouter: ReturnType<typeof createOpenAI> | null = null;

function resolveGeminiApiKey() {
  const apiKey = (import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new AIConfigError("GEMINI_API_KEY is not configured");
  }
  return apiKey;
}

function resolveOpenRouterApiKey() {
  const apiKey = (import.meta.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    throw new AIConfigError("OPENROUTER_API_KEY is not configured");
  }
  return apiKey;
}

function resolveOpenRouterModel() {
  return (import.meta.env.OPENROUTER_MODEL || process.env.OPENROUTER_MODEL || "openai/gpt-5-mini").trim();
}

function resolveOpenRouterBaseUrl() {
  return (import.meta.env.OPENROUTER_BASE_URL || process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").trim();
}

function getGoogle() {
  if (!_google) {
    _google = createGoogleGenerativeAI({
      apiKey: resolveGeminiApiKey(),
    });
  }
  return _google;
}

function getOpenRouter() {
  if (!_openrouter) {
    _openrouter = createOpenAI({
      apiKey: resolveOpenRouterApiKey(),
      baseURL: resolveOpenRouterBaseUrl(),
    });
  }
  return _openrouter;
}

type ChatModelCandidate = {
  name: string;
  model: LanguageModel;
};

function getConfiguredChatModels(): ChatModelCandidate[] {
  const candidates: ChatModelCandidate[] = [];

  const geminiKey = (import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "").trim();
  if (geminiKey) {
    candidates.push({
      name: "gemini-3-flash-preview",
      model: getGoogle()("gemini-3-flash-preview"),
    });
  }

  const openRouterKey = (import.meta.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || "").trim();
  if (openRouterKey) {
    const openRouterModel = resolveOpenRouterModel();
    candidates.push({
      name: `openrouter:${openRouterModel}`,
      model: getOpenRouter()(openRouterModel),
    });
  }

  if (candidates.length === 0) {
    throw new AIConfigError("No AI model configured. Set GEMINI_API_KEY and/or OPENROUTER_API_KEY.");
  }

  return candidates;
}

export function getChatModel() {
  return getConfiguredChatModels()[0].model;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

export async function withChatModelFallback<T>(run: (model: LanguageModel) => Promise<T>): Promise<T> {
  const candidates = getConfiguredChatModels();
  let lastError: unknown;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      return await run(candidate.model);
    } catch (error) {
      lastError = error;

      if (i < candidates.length - 1) {
        const nextCandidate = candidates[i + 1];
        console.warn(`[ai] ${candidate.name} failed, retrying with ${nextCandidate.name}`, {
          error: toErrorMessage(error),
        });
      }
    }
  }

  throw lastError;
}
