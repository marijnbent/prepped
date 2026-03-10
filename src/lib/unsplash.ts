export const UNSPLASH_API_BASE_URL = "https://api.unsplash.com";
const UNSPLASH_REFERRAL_SOURCE = "prepped";
const UNSPLASH_TIMEOUT_MS = 15_000;

export interface UnsplashPhotoResult {
  id: string;
  alt: string;
  smallUrl: string;
  regularUrl: string;
  authorName: string;
  authorUrl: string;
  photoUrl: string;
  downloadLocation: string;
}

export function getUnsplashAccessKey() {
  return (import.meta.env.UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_ACCESS_KEY || "").trim();
}

export function appendUnsplashReferral(url: string) {
  const target = new URL(url);
  target.searchParams.set("utm_source", UNSPLASH_REFERRAL_SOURCE);
  target.searchParams.set("utm_medium", "referral");
  return target.toString();
}

export function isUnsplashApiUrl(input: string) {
  try {
    const url = new URL(input);
    return url.protocol === "https:" && url.hostname === "api.unsplash.com" && url.pathname.startsWith("/photos/");
  } catch {
    return false;
  }
}

export function toUnsplashPhotoResult(photo: {
  id: string;
  alt_description?: string | null;
  description?: string | null;
  urls: { small: string; regular: string };
  links: { html: string; download_location: string };
  user: { name: string; links: { html: string } };
}): UnsplashPhotoResult {
  return {
    id: photo.id,
    alt: photo.alt_description || photo.description || photo.user.name,
    smallUrl: photo.urls.small,
    regularUrl: photo.urls.regular,
    authorName: photo.user.name,
    authorUrl: appendUnsplashReferral(photo.user.links.html),
    photoUrl: appendUnsplashReferral(photo.links.html),
    downloadLocation: photo.links.download_location,
  };
}

export async function fetchUnsplash(input: string, init: RequestInit = {}, timeoutMs = UNSPLASH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Version": "v1",
        ...init.headers,
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
