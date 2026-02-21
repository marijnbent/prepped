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

let _openrouter: ReturnType<typeof createOpenAI> | null = null;

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_PRIMARY_MODEL = "google/gemini-flash-latest";
const DEFAULT_OPENROUTER_FALLBACK_MODEL = "openai/gpt-5-mini";

function resolveOpenRouterApiKey() {
  const apiKey = (import.meta.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    throw new AIConfigError("OPENROUTER_API_KEY is not configured");
  }
  return apiKey;
}

function resolveOpenRouterPrimaryModel() {
  return (
    import.meta.env.OPENROUTER_PRIMARY_MODEL ||
    process.env.OPENROUTER_PRIMARY_MODEL ||
    import.meta.env.OPENROUTER_MODEL ||
    process.env.OPENROUTER_MODEL ||
    DEFAULT_OPENROUTER_PRIMARY_MODEL
  ).trim();
}

function splitModels(raw: string) {
  return raw
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

function resolveOpenRouterFallbackModels() {
  const modelsCsv = (import.meta.env.OPENROUTER_FALLBACK_MODELS || process.env.OPENROUTER_FALLBACK_MODELS || "").trim();
  if (modelsCsv) return splitModels(modelsCsv);

  const singleFallbackModel = (
    import.meta.env.OPENROUTER_FALLBACK_MODEL ||
    process.env.OPENROUTER_FALLBACK_MODEL ||
    DEFAULT_OPENROUTER_FALLBACK_MODEL
  ).trim();
  return singleFallbackModel ? [singleFallbackModel] : [];
}

function resolveOpenRouterBaseUrl() {
  return (import.meta.env.OPENROUTER_BASE_URL || process.env.OPENROUTER_BASE_URL || DEFAULT_OPENROUTER_BASE_URL).trim();
}

function getConfiguredOpenRouterModels() {
  const uniqueModels: string[] = [];
  const seen = new Set<string>();
  for (const model of [resolveOpenRouterPrimaryModel(), ...resolveOpenRouterFallbackModels()]) {
    if (seen.has(model)) continue;
    seen.add(model);
    uniqueModels.push(model);
  }

  if (uniqueModels.length === 0) {
    throw new AIConfigError(
      "No OpenRouter model configured. Set OPENROUTER_PRIMARY_MODEL/OPENROUTER_MODEL and optionally OPENROUTER_FALLBACK_MODEL(S).",
    );
  }

  return uniqueModels;
}

function getOpenRouter() {
  if (!_openrouter) {
    const headers: Record<string, string> = {};
    const appUrl = (import.meta.env.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || "").trim();
    const appName = (import.meta.env.OPENROUTER_APP_NAME || process.env.OPENROUTER_APP_NAME || "Prepped").trim();

    if (appUrl) headers["HTTP-Referer"] = appUrl;
    if (appName) headers["X-Title"] = appName;

    _openrouter = createOpenAI({
      apiKey: resolveOpenRouterApiKey(),
      baseURL: resolveOpenRouterBaseUrl(),
      headers,
    });
  }
  return _openrouter;
}

type ChatModelCandidate = {
  name: string;
  model: LanguageModel;
};

function getConfiguredChatModels(): ChatModelCandidate[] {
  return getConfiguredOpenRouterModels().map((modelId) => ({
    name: `openrouter:${modelId}`,
    model: getOpenRouter()(modelId),
  }));
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
