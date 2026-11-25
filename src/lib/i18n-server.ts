import { AsyncLocalStorage } from "node:async_hooks";
import { setLocaleResolver, type Locale } from "./i18n";

const localeStorage = new AsyncLocalStorage<Locale>();

setLocaleResolver(() => localeStorage.getStore());

/**
 * Run the remainder of a request inside a locale scope so server-rendered
 * components and API handlers resolve the current user's language.
 */
export function runWithLocale<T>(locale: Locale, run: () => T): T {
  return localeStorage.run(locale, run);
}
