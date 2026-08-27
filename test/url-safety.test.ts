import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { assertPublicHttpUrl, fetchPublicHttpUrl, UnsafeUrlError } from "../src/lib/url-safety";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("rejects local and private network targets", async () => {
  for (const url of [
    "http://127.0.0.1",
    "http://10.0.0.1",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]",
    "http://service.internal",
  ]) {
    await assert.rejects(assertPublicHttpUrl(url), UnsafeUrlError);
  }
});

test("validates redirect destinations before following them", async () => {
  globalThis.fetch = async () => new Response(null, {
    status: 302,
    headers: { location: "http://127.0.0.1/private" },
  });

  await assert.rejects(
    fetchPublicHttpUrl("https://93.184.216.34/recipe"),
    UnsafeUrlError,
  );
});

test("returns a normal response from a public target", async () => {
  globalThis.fetch = async () => new Response("recipe", { status: 200 });

  const response = await fetchPublicHttpUrl("https://93.184.216.34/recipe");
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "recipe");
});
