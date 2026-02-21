import { AIConfigError } from "./ai";

export interface AiClientError {
  status: 400 | 401 | 500 | 502 | 503;
  code: string;
  message: string;
  details?: string;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown AI error";
}

export function toAiClientError(error: unknown): AiClientError {
  if (error instanceof AIConfigError) {
    return {
      status: 503,
      code: error.code,
      message: "AI is not configured on the server. Please set OPENROUTER_API_KEY.",
      details: error.message,
    };
  }

  const rawMessage = getErrorMessage(error);
  const msg = rawMessage.toLowerCase();
  const statusCode = (() => {
    const candidate = (error as { statusCode?: unknown; status?: unknown })?.statusCode
      ?? (error as { statusCode?: unknown; status?: unknown })?.status;
    return typeof candidate === "number" ? candidate : null;
  })();

  if (statusCode === 401 || statusCode === 403) {
    return {
      status: 401,
      code: "AI_PROVIDER_AUTH",
      message: "AI provider rejected credentials. Check OPENROUTER_API_KEY and model access in OpenRouter.",
      details: rawMessage,
    };
  }

  if (statusCode === 429) {
    return {
      status: 503,
      code: "AI_PROVIDER_RATE_LIMIT",
      message: "AI provider is currently rate-limited. Please retry shortly.",
      details: rawMessage,
    };
  }

  if (statusCode === 408 || statusCode === 504) {
    return {
      status: 502,
      code: "AI_PROVIDER_TIMEOUT",
      message: "AI provider timed out. Please try again.",
      details: rawMessage,
    };
  }

  if (statusCode === 400) {
    if (msg.includes("image") || msg.includes("vision") || msg.includes("multimodal")) {
      return {
        status: 400,
        code: "AI_PROVIDER_UNSUPPORTED_IMAGE",
        message: "The configured AI model cannot read photos. Set OPENROUTER_PRIMARY_MODEL to a vision-capable model.",
        details: rawMessage,
      };
    }

    return {
      status: 400,
      code: "AI_PROVIDER_BAD_REQUEST",
      message: "AI request was rejected by the provider. Please retry with a shorter or simpler input.",
      details: rawMessage,
    };
  }

  if (
    msg.includes("unregistered callers") ||
    msg.includes("api key") ||
    msg.includes("permission denied") ||
    msg.includes("forbidden")
  ) {
    return {
      status: 401,
      code: "AI_PROVIDER_AUTH",
      message: "AI provider rejected credentials. Check OPENROUTER_API_KEY and model access in OpenRouter.",
      details: rawMessage,
    };
  }

  if (msg.includes("quota") || msg.includes("rate limit")) {
    return {
      status: 503,
      code: "AI_PROVIDER_RATE_LIMIT",
      message: "AI provider is currently rate-limited. Please retry shortly.",
      details: rawMessage,
    };
  }

  if (msg.includes("timeout") || msg.includes("timed out")) {
    return {
      status: 502,
      code: "AI_PROVIDER_TIMEOUT",
      message: "AI provider timed out. Please try again.",
      details: rawMessage,
    };
  }

  return {
    status: 500,
    code: "AI_INTERNAL_ERROR",
    message: "AI request failed. Please try again.",
    details: rawMessage,
  };
}
