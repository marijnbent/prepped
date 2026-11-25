import assert from "node:assert/strict";
import test from "node:test";
import { runWithLocale } from "../src/lib/i18n-server";
import { getDateLocale, getLocale, resolveLocale, t } from "../src/lib/i18n";

test("resolves only supported locales", () => {
  assert.equal(resolveLocale("fi"), "fi");
  assert.equal(resolveLocale("fi-FI"), "fi");
  assert.equal(resolveLocale("NL_nl"), "nl");
  assert.equal(resolveLocale("de"), undefined);
  assert.equal(resolveLocale(""), undefined);
  assert.equal(resolveLocale(null), undefined);
});

test("uses a locale scope for translations and dates", () => {
  runWithLocale("fi", () => {
    assert.equal(getLocale(), "fi");
    assert.equal(t("nav.home"), "Etusivu");
    assert.equal(getDateLocale(), "fi-FI");
  });

  assert.equal(getLocale(), "en");
  assert.equal(t("nav.home"), "Home");
});

test("keeps concurrent locale scopes isolated across async work", async () => {
  const translations = await Promise.all([
    runWithLocale("fi", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return t("nav.recipes");
    }),
    runWithLocale("nl", async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return t("nav.recipes");
    }),
  ]);

  assert.deepEqual(translations, ["Reseptit", "Recepten"]);
});
