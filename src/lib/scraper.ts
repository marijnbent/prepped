import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

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

export type ScrapeMode = "direct" | "scrape" | "scrape-super";

const DEFAULT_SCRAPE_DO_BASE_URL = "http://api.scrape.do/";
const DEFAULT_SCRAPE_DO_GEO_CODE = "NL";
const DEFAULT_BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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
    "captcha",
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

function parseHtml(url: string, html: string): ScrapeResult {
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

  const contentParts = [
    structured.content,
    article?.textContent?.trim() || "",
  ].filter((part) => part.length > 0);

  if (contentParts.length === 0) {
    throw new ScrapeError("Could not parse page content", "SCRAPE_PARSE_FAILED");
  }

  return {
    title: article?.title || structured.title || doc.title || "Imported recipe",
    content: contentParts.join("\n\n"),
    imageUrl: extractImageUrl(doc),
    videoUrl: extractVideoUrl(doc, html),
  };
}

async function fetchDirectHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": DEFAULT_BROWSER_UA,
    },
  });

  if (response.status === 403 || response.status === 503) {
    throw new ScrapeError(`Website blocked the request (${response.status})`, "SCRAPE_BLOCKED");
  }

  if (!response.ok) {
    throw new ScrapeError(`Failed to fetch URL: ${response.status}`, "SCRAPE_FAILED");
  }

  return response.text();
}

async function fetchScrapeDoHtml(url: string, mode: "scrape" | "scrape-super"): Promise<string> {
  const token = (import.meta.env.SCRAPE_DO_TOKEN || process.env.SCRAPE_DO_TOKEN || "").trim();
  if (!token) {
    throw new ScrapeError(
      "Scrape.do fallback is not configured (SCRAPE_DO_TOKEN missing).",
      "SCRAPE_CONFIG_MISSING",
    );
  }

  const baseUrl = (import.meta.env.SCRAPE_DO_BASE_URL || process.env.SCRAPE_DO_BASE_URL || DEFAULT_SCRAPE_DO_BASE_URL).trim();
  const geoCode = (import.meta.env.SCRAPE_DO_GEO_CODE || process.env.SCRAPE_DO_GEO_CODE || DEFAULT_SCRAPE_DO_GEO_CODE).trim();
  const apiUrl = new URL(baseUrl);

  apiUrl.searchParams.set("url", url);
  apiUrl.searchParams.set("token", token);
  apiUrl.searchParams.set("geoCode", geoCode);

  if (mode === "scrape-super") {
    apiUrl.searchParams.set("super", "true");
    apiUrl.searchParams.set("render", "true");
    apiUrl.searchParams.set("blockResources", "false");
    apiUrl.searchParams.set("customWait", "2000");
    apiUrl.searchParams.set("waitUntil", "networkidle0");
  }

  const response = await fetch(apiUrl.toString(), {
    headers: {
      "User-Agent": DEFAULT_BROWSER_UA,
    },
  });

  if (!response.ok) {
    throw new ScrapeError(`Scrape.do request failed: ${response.status}`, "SCRAPE_FAILED");
  }

  return response.text();
}

async function fetchHtml(url: string, mode: ScrapeMode): Promise<string> {
  if (mode === "direct") {
    return fetchDirectHtml(url);
  }
  return fetchScrapeDoHtml(url, mode);
}

export async function scrapeUrl(url: string, mode: ScrapeMode = "direct"): Promise<ScrapeResult> {
  if (isInstagramUrl(url)) {
    return scrapeInstagram(url);
  }
  const html = await fetchHtml(url, mode);
  return parseHtml(url, html);
}
