import { createGoogleGenerativeAI } from "@ai-sdk/google";

let _google: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getGoogle() {
  if (!_google) {
    _google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY || "",
    });
  }
  return _google;
}

export function getChatModel() {
  return getGoogle()("gemini-3-flash-preview");
}
