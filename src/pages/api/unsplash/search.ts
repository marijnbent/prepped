import type { APIRoute } from "astro";
import { fetchUnsplash, getUnsplashAccessKey, toUnsplashPhotoResult, UNSPLASH_API_BASE_URL } from "../../../lib/unsplash";

interface UnsplashSearchResponse {
  results?: Array<{
    id: string;
    alt_description?: string | null;
    description?: string | null;
    urls: { small: string; regular: string };
    links: { html: string; download_location: string };
    user: { name: string; links: { html: string } };
  }>;
  errors?: string[];
}

export const GET: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const accessKey = getUnsplashAccessKey();
  if (!accessKey) {
    return new Response(JSON.stringify({ error: "Unsplash is not configured yet." }), { status: 503 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() || "";
  if (!query) {
    return new Response(JSON.stringify({ error: "Search query is required." }), { status: 400 });
  }

  const upstreamUrl = new URL(`${UNSPLASH_API_BASE_URL}/search/photos`);
  upstreamUrl.searchParams.set("query", query);
  upstreamUrl.searchParams.set("page", "1");
  upstreamUrl.searchParams.set("per_page", "15");
  upstreamUrl.searchParams.set("orientation", "landscape");
  upstreamUrl.searchParams.set("content_filter", "high");

  try {
    const response = await fetchUnsplash(upstreamUrl.toString(), {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
    });

    const data = await response.json().catch(() => null) as UnsplashSearchResponse | null;

    if (!response.ok) {
      const upstreamMessage = data?.errors?.find((value) => typeof value === "string" && value.trim());
      const message = response.status === 401
        ? "Unsplash rejected the access key. Check UNSPLASH_ACCESS_KEY and restart the server."
        : upstreamMessage || "Unsplash search failed.";

      return new Response(JSON.stringify({ error: message }), { status: 502 });
    }

    const results = Array.isArray(data.results) ? data.results.map(toUnsplashPhotoResult) : [];

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "Unsplash search timed out."
      : "Unsplash search failed.";

    return new Response(JSON.stringify({ error: message }), { status: 502 });
  }
};
