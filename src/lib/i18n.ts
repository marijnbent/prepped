import en from "./i18n/en";
import nl from "./i18n/nl";
import fi from "./i18n/fi";

const strings = { en, nl, fi } as const;

export type Locale = keyof typeof strings;
type StringKey = keyof typeof en;

export const localeNames = {
  en: "English",
  nl: "Nederlands",
  fi: "Suomi",
} as const satisfies Record<Locale, string>;

export const supportedLocales = Object.keys(strings) as Locale[];

export function translatedValues(key: StringKey): string[] {
  return supportedLocales.map((locale) => strings[locale][key]);
}

type LocaleResolver = () => Locale | undefined;

const localeResolverKey = "__preppedLocaleResolver";
type GlobalWithLocaleResolver = typeof globalThis & { __preppedLocaleResolver?: LocaleResolver };

let cachedDocumentLocale: Locale | undefined;

/**
 * Register a request-scoped locale resolver (server only). The resolver takes
 * precedence over the document and environment fallbacks. It lives on
 * globalThis so separately bundled server modules share one instance.
 */
export function setLocaleResolver(resolver: LocaleResolver) {
  (globalThis as GlobalWithLocaleResolver)[localeResolverKey] = resolver;
}

function getLocaleResolver(): LocaleResolver | undefined {
  return (globalThis as GlobalWithLocaleResolver)[localeResolverKey];
}

export function resolveLocale(value?: string | null): Locale | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().replace(/_/g, "-").split("-")[0];
  return normalized in strings ? (normalized as Locale) : undefined;
}

function localeFromDocument(): Locale | undefined {
  if (typeof document === "undefined") return undefined;
  if (cachedDocumentLocale) return cachedDocumentLocale;
  cachedDocumentLocale = resolveLocale(document.documentElement.dataset.locale || document.documentElement.lang);
  return cachedDocumentLocale;
}

export function getLocale(): Locale {
  return getLocaleResolver()?.()
    ?? localeFromDocument()
    ?? resolveLocale(import.meta.env?.PUBLIC_UI_LOCALE)
    ?? "en";
}

export function t(key: StringKey): string {
  const locale = getLocale();
  return strings[locale][key] || strings["en"][key] || key;
}

const dateLocales: Record<Locale, string> = {
  en: "en-US",
  nl: "nl-NL",
  fi: "fi-FI",
};

export function getDateLocale(): string {
  return (import.meta.env?.PUBLIC_DATE_LOCALE || dateLocales[getLocale()]).replace(/_/g, "-");
}

export function formatDate(date: string | Date): string {
  try {
    return new Date(date).toLocaleDateString(getDateLocale(), {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
}
