/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly BETTER_AUTH_SECRET: string;
  readonly BETTER_AUTH_URL: string;
  readonly GEMINI_API_KEY: string;
  readonly INVITE_CODE: string;
  readonly MEASUREMENT_SYSTEM: "metric" | "imperial";
  readonly UI_LOCALE: "en" | "nl";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    user: { id: string; name: string; email: string } | null;
  }
}
