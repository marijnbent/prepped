import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export class ScrapeError extends Error {
  code: "SCRAPE_BLOCKED" | "SCRAPE_FAILED" | "SCRAPE_PARSE_FAILED";

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

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  if (isInstagramUrl(url)) {
    return scrapeInstagram(url);
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (response.status === 403 || response.status === 503) {
    throw new ScrapeError(
      `Website blocked the request (${response.status})`,
      "SCRAPE_BLOCKED",
    );
  }

  if (!response.ok) {
    throw new ScrapeError(
      `Failed to fetch URL: ${response.status}`,
      "SCRAPE_FAILED",
    );
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  // Extract YouTube video URL from the raw HTML before Readability strips it
  let videoUrl: string | null = null;
  const youtubePatterns = [
    // iframe embeds
    ...Array.from(doc.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"]')).map(
      (el) => el.getAttribute("src")
    ),
    // data attributes with youtube URLs
    ...Array.from(doc.querySelectorAll("[data-video-url], [data-src]"))
      .map((el) => el.getAttribute("data-video-url") || el.getAttribute("data-src"))
      .filter((s) => s && (s.includes("youtube.com") || s.includes("youtu.be"))),
  ];

  // Also search for youtube URLs in the raw HTML
  const ytMatch = html.match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );

  if (youtubePatterns.length > 0 && youtubePatterns[0]) {
    const src = youtubePatterns[0];
    const idMatch = src.match(/(?:embed\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (idMatch) {
      videoUrl = `https://www.youtube.com/watch?v=${idMatch[1]}`;
    }
  } else if (ytMatch) {
    videoUrl = `https://www.youtube.com/watch?v=${ytMatch[1]}`;
  }

  // Extract main image - try og:image first, then largest image
  let imageUrl: string | null = null;
  const ogImage = doc.querySelector('meta[property="og:image"]');
  if (ogImage) {
    imageUrl = ogImage.getAttribute("content");
  }
  if (!imageUrl) {
    const twitterImage = doc.querySelector('meta[name="twitter:image"]');
    if (twitterImage) {
      imageUrl = twitterImage.getAttribute("content");
    }
  }

  // Parse with Readability
  const reader = new Readability(doc);
  const article = reader.parse();

  if (!article) {
    throw new ScrapeError("Could not parse page content", "SCRAPE_PARSE_FAILED");
  }

  return {
    title: article.title,
    content: article.textContent,
    imageUrl,
    videoUrl,
  };
}
