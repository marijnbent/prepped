import type { APIRoute } from "astro";
import { UnsafeUrlError, assertPublicHttpUrl } from "../../../lib/url-safety";
import { fetchUnsplash, getUnsplashAccessKey, isUnsplashApiUrl } from "../../../lib/unsplash";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const accessKey = getUnsplashAccessKey();
  if (!accessKey) {
    return new Response(JSON.stringify({ error: "Unsplash is not configured yet." }), { status: 503 });
  }

  const body = await request.json().catch(() => null) as { downloadLocation?: unknown } | null;
  const downloadLocation = typeof body?.downloadLocation === "string" ? body.downloadLocation : "";
  if (!downloadLocation) {
    return new Response(JSON.stringify({ error: "Download location is required." }), { status: 400 });
  }

  try {
    const safeUrl = (await assertPublicHttpUrl(downloadLocation)).toString();
    if (!isUnsplashApiUrl(safeUrl)) {
      return new Response(JSON.stringify({ error: "Invalid Unsplash download location." }), { status: 400 });
    }

    const response = await fetchUnsplash(safeUrl, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null) as { errors?: string[] } | null;
      const upstreamMessage = data?.errors?.find((value) => typeof value === "string" && value.trim());
      const message = response.status === 401
        ? "Unsplash rejected the access key. Check UNSPLASH_ACCESS_KEY and restart the server."
        : upstreamMessage || "Unsplash download tracking failed.";

      return new Response(JSON.stringify({ error: message }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    const message = error instanceof DOMException && error.name === "AbortError"
      ? "Unsplash download tracking timed out."
      : "Unsplash download tracking failed.";

    return new Response(JSON.stringify({ error: message }), { status: 502 });
  }
};
