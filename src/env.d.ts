/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly BETTER_AUTH_SECRET: string;
  readonly BETTER_AUTH_URL: string;
  readonly GEMINI_API_KEY?: string;
  readonly OPENROUTER_API_KEY?: string;
  readonly OPENROUTER_MODEL?: string;
  readonly OPENROUTER_BASE_URL?: string;
  readonly INVITE_CODE: string;
  readonly MEASUREMENT_SYSTEM: "metric" | "imperial";
  readonly PUBLIC_UI_LOCALE: "en" | "nl";
  readonly PUBLIC_DATE_LOCALE: string;
  readonly AUTH_MODE?: "simple" | "password";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    user: { id: string; name: string; email: string } | null;
  }
}
