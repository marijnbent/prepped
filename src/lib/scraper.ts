import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { assertPublicHttpUrl } from "./url-safety";

export class ScrapeError extends Error {
  code: "SCRAPE_BLOCKED" | "SCRAPE_FAILED" | "SCRAPE_PARSE_FAILED" | "SCRAPE_CONFIG_MISSING";

  constructor(message: string, code: ScrapeError["code"]) {
    super(message);
    this.name = "ScrapeError";
    this.code = code;
  }
}

interface ScrapeResult {
  title: string;
  content: string;
  imageUrl: string | null;
  videoUrl: string | null;
}

export type ScrapeMode = "direct" | "browser" | "browser-advanced";

type CloudflareMode = Exclude<ScrapeMode, "direct">;

interface HtmlFetchResult {
  html: string;
  supplementalContent?: string;
}

interface CloudflareApiError {
  code?: number | string;
  message?: string;
}

interface CloudflareApiEnvelope<T> {
  success?: boolean;
  result?: T;
  errors?: CloudflareApiError[];
}

interface CloudflareScrapeNode {
  text?: string;
  html?: string;
}

interface CloudflareScrapeGroup {
  selector?: string;
  results?: CloudflareScrapeNode[];
}

const DEFAULT_CLOUDFLARE_API_BASE_URL = "https://api.cloudflare.com/client/v4";
const DEFAULT_BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SCRAPE_FETCH_TIMEOUT_MS = 20_000;
const BROWSER_RENDER_TIMEOUT_MS = 30_000;
const BROWSER_RENDER_ADVANCED_TIMEOUT_MS = 45_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_CLOUDFLARE_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_SUPPLEMENTAL_CONTENT_CHARS = 12_000;
const DEFAULT_CLOUDFLARE_BROWSER_RUN_MIN_INTERVAL_MS = 10_000;
const CLOUDFLARE_SCRAPE_SELECTORS = [
  "h1",
  "main",
  "article",
  "[itemtype*='Recipe']",
  "[class*='recipe']",
  "[id*='recipe']",
  ".wprm-recipe-container",
  ".tasty-recipes",
  ".recipe-card",
  ".entry-content",
  ".post-content",
];

let cloudflareQuickActionQueue: Promise<void> = Promise.resolve();
let nextCloudflareQuickActionAt = 0;

function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = SCRAPE_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
  });
}

async function readResponseTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const fallback = await response.text();
    if (Buffer.byteLength(fallback, "utf8") > maxBytes) {
      throw new ScrapeError("Response body too large", "SCRAPE_FAILED");
    }
    return fallback;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      throw new ScrapeError("Response body too large", "SCRAPE_FAILED");
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(combined);
}

async function scrapeInstagram(url: string): Promise<ScrapeResult> {
  const oembedUrl = `https://i.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`;
  const response = await fetch(oembedUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!response.ok) {
    throw new Error(`Instagram oEmbed failed: ${response.status}`);
  }

  const data = await response.json();
  const caption: string = data.title || "";
  const author: string = data.author_name || "";

  return {
    title: caption.split("\n")[0].trim() || `Recipe by ${author}`,
    content: caption,
    imageUrl: data.thumbnail_url || null,
    videoUrl: url,
  };
}

function isInstagramUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?instagram\.com\/(p|reel)\//.test(url);
}

function isChallengePage(html: string): boolean {
  const lower = html.toLowerCase();
  const markers = [
    "just a moment...",
    "checking your browser",
    "enable javascript and cookies to continue",
    "access denied",
    "reference #",
    "sec-if-cpt-container",
    "powered and protected by",
    "cdn-cgi/challenge-platform",
    "verifies you are not a bot",
  ];
  return markers.some((marker) => lower.includes(marker));
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function getRecipeNodes(input: unknown): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];

  const visit = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== "object") return;

    const obj = value as Record<string, unknown>;
    const typeValue = obj["@type"];
    const types = Array.isArray(typeValue) ? typeValue : [typeValue];
    if (types.some((t) => typeof t === "string" && t.toLowerCase() === "recipe")) {
      nodes.push(obj);
    }

    if (obj["@graph"]) {
      visit(obj["@graph"]);
    }
  };

  visit(input);
  return nodes;
}

function recipeInstructionsToStrings(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap(recipeInstructionsToStrings).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (typeof value !== "object") return [];

  const obj = value as Record<string, unknown>;
  const text = typeof obj.text === "string" ? obj.text.trim() : "";
  if (text) return [text];

  if (obj.itemListElement) {
    return recipeInstructionsToStrings(obj.itemListElement);
  }
  return [];
}

function extractStructuredRecipeContent(doc: Document): { title: string | null; content: string } {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  const recipes: Record<string, unknown>[] = [];

  for (const script of scripts) {
    const raw = script.textContent?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      recipes.push(...getRecipeNodes(parsed));
    } catch {
      // Ignore invalid JSON-LD.
    }
  }

  if (recipes.length === 0) {
    return { title: null, content: "" };
  }

  const recipe = recipes[0];
  const recipeTitle = typeof recipe.name === "string" ? recipe.name.trim() : "";
  const recipeDescription = typeof recipe.description === "string" ? recipe.description.trim() : "";
  const recipeYield = typeof recipe.recipeYield === "string" ? recipe.recipeYield.trim() : "";
  const ingredients = asStringArray(recipe.recipeIngredient).slice(0, 120);
  const instructions = recipeInstructionsToStrings(recipe.recipeInstructions).slice(0, 80);

  const lines: string[] = [];
  if (recipeTitle) lines.push(`Structured title: ${recipeTitle}`);
  if (recipeDescription) lines.push(`Structured description: ${recipeDescription}`);
  if (recipeYield) lines.push(`Structured yield: ${recipeYield}`);
  if (ingredients.length > 0) {
    lines.push("Structured ingredients:");
    for (const ingredient of ingredients) {
      lines.push(`- ${ingredient}`);
    }
  }
  if (instructions.length > 0) {
    lines.push("Structured instructions:");
    for (let index = 0; index < instructions.length; index += 1) {
      lines.push(`${index + 1}. ${instructions[index]}`);
    }
  }

  return {
    title: recipeTitle || null,
    content: lines.join("\n").trim(),
  };
}

function extractVideoUrl(doc: Document, html: string): string | null {
  const youtubePatterns = [
    ...Array.from(doc.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"]')).map(
      (el) => el.getAttribute("src")
    ),
    ...Array.from(doc.querySelectorAll("[data-video-url], [data-src]"))
      .map((el) => el.getAttribute("data-video-url") || el.getAttribute("data-src"))
      .filter((s) => s && (s.includes("youtube.com") || s.includes("youtu.be"))),
  ];

  const ytMatch = html.match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );

  if (youtubePatterns.length > 0 && youtubePatterns[0]) {
    const src = youtubePatterns[0];
    const idMatch = src.match(/(?:embed\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (idMatch) {
      return `https://www.youtube.com/watch?v=${idMatch[1]}`;
    }
  }

  if (ytMatch) {
    return `https://www.youtube.com/watch?v=${ytMatch[1]}`;
  }

  return null;
}

function extractImageUrl(doc: Document): string | null {
  const ogImage = doc.querySelector('meta[property="og:image"]');
  if (ogImage?.getAttribute("content")) {
    return ogImage.getAttribute("content");
  }

  const twitterImage = doc.querySelector('meta[name="twitter:image"]');
  if (twitterImage?.getAttribute("content")) {
    return twitterImage.getAttribute("content");
  }

  return null;
}

function normalizeForComparison(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function mergeContentParts(parts: string[]): string {
  const merged: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const normalized = normalizeForComparison(trimmed);
    const alreadyCovered = merged.some((existing) => {
      const normalizedExisting = normalizeForComparison(existing);
      return normalizedExisting.includes(normalized) || normalized.includes(normalizedExisting);
    });

    if (!alreadyCovered) {
      merged.push(trimmed);
    }
  }

  return merged.join("\n\n");
}

function parseHtml(url: string, html: string, supplementalContent = ""): ScrapeResult {
  if (isChallengePage(html)) {
    throw new ScrapeError("Page returned anti-bot challenge", "SCRAPE_BLOCKED");
  }

  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  const structured = extractStructuredRecipeContent(doc);
  const reader = new Readability(doc);
  const article = reader.parse();

  if (article && isChallengePage(article.textContent || "")) {
    throw new ScrapeError("Parsed content indicates anti-bot challenge", "SCRAPE_BLOCKED");
  }

  const articleText = article?.textContent?.trim() || "";
  const contentParts = [
    structured.content,
    articleText,
    articleText.length < 600 ? supplementalContent : "",
  ].filter((part) => part.length > 0);
  const mergedContent = mergeContentParts(contentParts);

  if (!mergedContent) {
    throw new ScrapeError("Could not parse page content", "SCRAPE_PARSE_FAILED");
  }

  return {
    title: article?.title || structured.title || doc.title || "Imported recipe",
    content: mergedContent,
    imageUrl: extractImageUrl(doc),
    videoUrl: extractVideoUrl(doc, html),
  };
}

async function fetchDirectHtml(url: string): Promise<HtmlFetchResult> {
  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": DEFAULT_BROWSER_UA,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ScrapeError("Timed out while fetching URL", "SCRAPE_FAILED");
    }
    throw new ScrapeError("Failed to fetch URL", "SCRAPE_FAILED");
  }

  if (response.status === 403 || response.status === 503) {
    throw new ScrapeError(`Website blocked the request (${response.status})`, "SCRAPE_BLOCKED");
  }

  if (!response.ok) {
    throw new ScrapeError(`Failed to fetch URL: ${response.status}`, "SCRAPE_FAILED");
  }

  return {
    html: await readResponseTextWithLimit(response, MAX_HTML_BYTES),
  };
}

function getCloudflareToken(): string {
  const token = (import.meta.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "").trim();
  if (!token) {
    throw new ScrapeError(
      "Cloudflare Browser Run fallback is not configured (CLOUDFLARE_API_TOKEN missing).",
      "SCRAPE_CONFIG_MISSING",
    );
  }
  return token;
}

function getCloudflareAccountId(): string {
  const accountId = (import.meta.env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  if (!accountId) {
    throw new ScrapeError(
      "Cloudflare Browser Run fallback is not configured (CLOUDFLARE_ACCOUNT_ID missing).",
      "SCRAPE_CONFIG_MISSING",
    );
  }
  return accountId;
}

function cloudflareErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Cloudflare API returned an unknown error";
  }

  const errors = Array.isArray((payload as CloudflareApiEnvelope<unknown>).errors)
    ? (payload as CloudflareApiEnvelope<unknown>).errors
    : [];
  const messages = errors
    .map((error) => {
      if (!error) return "";
      if (error.code && error.message) return `${error.code}: ${error.message}`;
      return error.message || "";
    })
    .filter(Boolean);

  return messages.join("; ") || "Cloudflare API returned an unknown error";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCloudflareBrowserRunMinIntervalMs(): number {
  const rawValue = (
    import.meta.env.CLOUDFLARE_BROWSER_RUN_MIN_INTERVAL_MS ||
    process.env.CLOUDFLARE_BROWSER_RUN_MIN_INTERVAL_MS ||
    ""
  ).trim();

  if (!rawValue) {
    return DEFAULT_CLOUDFLARE_BROWSER_RUN_MIN_INTERVAL_MS;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_CLOUDFLARE_BROWSER_RUN_MIN_INTERVAL_MS;
  }

  return parsed;
}

async function waitForCloudflareQuickActionSlot(): Promise<void> {
  const minIntervalMs = getCloudflareBrowserRunMinIntervalMs();
  if (minIntervalMs <= 0) {
    return;
  }

  let releaseQueue!: () => void;
  const previousQueue = cloudflareQuickActionQueue;
  cloudflareQuickActionQueue = new Promise((resolve) => {
    releaseQueue = resolve;
  });

  await previousQueue;

  try {
    const waitMs = Math.max(0, nextCloudflareQuickActionAt - Date.now());
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    nextCloudflareQuickActionAt = Date.now() + minIntervalMs;
  } finally {
    releaseQueue();
  }
}

async function requestCloudflareQuickAction<T>(
  action: "content" | "scrape",
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<T> {
  await waitForCloudflareQuickActionSlot();

  const token = getCloudflareToken();
  const accountId = getCloudflareAccountId();
  const apiUrl = new URL(
    `accounts/${accountId}/browser-rendering/${action}`,
    `${DEFAULT_CLOUDFLARE_API_BASE_URL}/`,
  );
  apiUrl.searchParams.set("cacheTTL", "0");

  let response: Response;
  try {
    response = await fetchWithTimeout(apiUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }, timeoutMs);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ScrapeError("Timed out while rendering the page", "SCRAPE_FAILED");
    }
    throw new ScrapeError("Cloudflare Browser Run request failed", "SCRAPE_FAILED");
  }

  const responseText = await readResponseTextWithLimit(response, MAX_CLOUDFLARE_RESPONSE_BYTES);

  let payload: CloudflareApiEnvelope<T> | null = null;
  try {
    payload = JSON.parse(responseText) as CloudflareApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ScrapeError(
      `Cloudflare Browser Run request failed: ${payload ? cloudflareErrorMessage(payload) : response.status}`,
      "SCRAPE_FAILED",
    );
  }

  if (!payload || payload.success === false || payload.result === undefined) {
    throw new ScrapeError(cloudflareErrorMessage(payload), "SCRAPE_FAILED");
  }

  return payload.result;
}

function stripHtmlToText(html: string): string {
  return JSDOM.fragment(html).textContent?.replace(/\s+/g, " ").trim() || "";
}

function buildSupplementalContent(groups: CloudflareScrapeGroup[]): string {
  const pieces: string[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    const results = Array.isArray(group.results) ? group.results.slice(0, 4) : [];
    for (const result of results) {
      const text = typeof result.text === "string" && result.text.trim()
        ? result.text.trim()
        : typeof result.html === "string" && result.html.trim()
          ? stripHtmlToText(result.html)
          : "";

      if (!text) continue;

      const normalized = normalizeForComparison(text);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      pieces.push(text);

      if (pieces.join("\n\n").length >= MAX_SUPPLEMENTAL_CONTENT_CHARS) {
        return pieces.join("\n\n").slice(0, MAX_SUPPLEMENTAL_CONTENT_CHARS);
      }
    }
  }

  return pieces.join("\n\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildSyntheticHtmlFromSupplemental(url: string, supplementalContent: string): string {
  const title = supplementalContent.split("\n").find((line) => line.trim()) || "Imported recipe";
  const paragraphs = supplementalContent
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part)}</p>`)
    .join("\n");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <link rel="canonical" href="${escapeHtml(url)}" />
  </head>
  <body>
    <article>
      <h1>${escapeHtml(title)}</h1>
      ${paragraphs}
    </article>
  </body>
</html>`;
}

async function fetchCloudflareHtml(url: string, mode: CloudflareMode): Promise<HtmlFetchResult> {
  const timeoutMs = mode === "browser-advanced" ? BROWSER_RENDER_ADVANCED_TIMEOUT_MS : BROWSER_RENDER_TIMEOUT_MS;
  const body: Record<string, unknown> = {
    url,
    userAgent: DEFAULT_BROWSER_UA,
  };

  if (mode === "browser-advanced") {
    body.gotoOptions = { waitUntil: "networkidle0" };
  }

  const html = await requestCloudflareQuickAction<string>("content", body, timeoutMs);
  if (typeof html !== "string" || !html.trim()) {
    throw new ScrapeError("Cloudflare Browser Run returned empty HTML", "SCRAPE_FAILED");
  }

  if (mode !== "browser-advanced") {
    return { html };
  }

  try {
    const groups = await requestCloudflareQuickAction<CloudflareScrapeGroup[]>(
      "scrape",
      {
        ...body,
        elements: CLOUDFLARE_SCRAPE_SELECTORS.map((selector) => ({ selector })),
      },
      timeoutMs,
    );
    return {
      html,
      supplementalContent: Array.isArray(groups) ? buildSupplementalContent(groups) : "",
    };
  } catch (error) {
    if (error instanceof ScrapeError) {
      return { html };
    }
    throw error;
  }
}

async function fetchHtml(url: string, mode: ScrapeMode): Promise<HtmlFetchResult> {
  if (mode === "direct") {
    return fetchDirectHtml(url);
  }

  try {
    return await fetchCloudflareHtml(url, mode);
  } catch (error) {
    if (mode !== "browser-advanced" || !(error instanceof ScrapeError)) {
      throw error;
    }

    const groups = await requestCloudflareQuickAction<CloudflareScrapeGroup[]>(
      "scrape",
      {
        url,
        userAgent: DEFAULT_BROWSER_UA,
        gotoOptions: { waitUntil: "networkidle0" },
        elements: CLOUDFLARE_SCRAPE_SELECTORS.map((selector) => ({ selector })),
      },
      BROWSER_RENDER_ADVANCED_TIMEOUT_MS,
    );
    const supplementalContent = Array.isArray(groups) ? buildSupplementalContent(groups) : "";
    if (!supplementalContent) {
      throw error;
    }
    return {
      html: buildSyntheticHtmlFromSupplemental(url, supplementalContent),
      supplementalContent,
    };
  }
}

export async function scrapeUrl(url: string, mode: ScrapeMode = "direct"): Promise<ScrapeResult> {
  const safeUrl = (await assertPublicHttpUrl(url)).toString();

  if (isInstagramUrl(safeUrl)) {
    return scrapeInstagram(safeUrl);
  }
  const { html, supplementalContent } = await fetchHtml(safeUrl, mode);
  return parseHtml(safeUrl, html, supplementalContent);
}
