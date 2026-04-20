import type { APIRoute } from "astro";
import { generateObject } from "ai";
import { withChatModelFallback } from "../../../lib/ai";
import { scrapeUrl, ScrapeError, type ScrapeMode } from "../../../lib/scraper";
import { downloadAndSaveImage } from "../../../lib/images";
import { toAiClientError } from "../../../lib/ai-errors";
import { assertPublicHttpUrl, UnsafeUrlError } from "../../../lib/url-safety";
import {
  recipeOutputSchema,
  resolveTagIds,
  resolveCollectionIds,
  getImportContext,
  buildImportRules,
  normalizeImportedIngredients,
} from "../../../lib/import-shared";

type ImportMode = ScrapeMode | "auto";

function nextModeFor(currentMode: ImportMode): ScrapeMode | undefined {
  if (currentMode === "direct") return "browser";
  if (currentMode === "browser") return "browser-advanced";
  return undefined;
}

function canAutoRetry(err: ScrapeError): boolean {
  return (
    err.code === "SCRAPE_BLOCKED" ||
    err.code === "SCRAPE_PARSE_FAILED" ||
    err.code === "SCRAPE_FAILED"
  );
}

async function scrapeWithMode(url: string, mode: ImportMode) {
  if (mode !== "auto") {
    return scrapeUrl(url, mode);
  }

  const sequence: ScrapeMode[] = ["direct", "browser", "browser-advanced"];
  let lastError: ScrapeError | null = null;

  for (const stage of sequence) {
    try {
      return await scrapeUrl(url, stage);
    } catch (err) {
      if (err instanceof ScrapeError) {
        lastError = err;
        const isLastStage = stage === "browser-advanced";
        if (!isLastStage && canAutoRetry(err)) {
          continue;
        }
      }
      throw err;
    }
  }

  throw lastError || new ScrapeError("Could not read page content", "SCRAPE_FAILED");
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const url = typeof body?.url === "string" ? body.url : "";
  const rawMode = body?.mode;
  const mode: ImportMode = rawMode === undefined ? "auto" : rawMode;

  if (!url || typeof url !== "string") {
    return new Response(JSON.stringify({ error: "URL required" }), { status: 400 });
  }

  if (!["direct", "browser", "browser-advanced", "auto"].includes(mode)) {
    return new Response(JSON.stringify({ error: "Invalid mode" }), { status: 400 });
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = (await assertPublicHttpUrl(url)).toString();
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return new Response(JSON.stringify({ error: err.message, code: err.code }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Invalid URL" }), { status: 400 });
  }

  const ctx = getImportContext(locals.user.id);
  const rules = buildImportRules(ctx);

  try {
    const { title, content, imageUrl, videoUrl } = await scrapeWithMode(normalizedUrl, mode);

    const { object: recipe } = await withChatModelFallback((model) =>
      generateObject({
        model,
        schema: recipeOutputSchema,
        prompt: `Extract a structured recipe from the following web page content.

${rules}

Page title: ${title}

Content:
${content.slice(0, 10000)}${ctx.userInstruction}`,
      })
    );

    const tagIds = recipe.tags?.length ? resolveTagIds(recipe.tags) : [];
    const collectionIds = recipe.collections?.length
      ? resolveCollectionIds(recipe.collections, locals.user.id)
      : [];

    const normalizedIngredients = normalizeImportedIngredients(recipe.ingredients);

    let localImageUrl: string | undefined;
    if (imageUrl) {
      try {
        const { full } = await downloadAndSaveImage(imageUrl, "recipes");
        localImageUrl = full;
      } catch (err) {
        if (err instanceof UnsafeUrlError) {
          localImageUrl = undefined;
        } else {
        localImageUrl = imageUrl;
        }
      }
    }

    return new Response(
      JSON.stringify({
        ...recipe,
        ingredients: normalizedIngredients,
        tagIds,
        collectionIds,
        sourceUrl: normalizedUrl,
        imageUrl: localImageUrl,
        videoUrl: videoUrl || undefined,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return new Response(
        JSON.stringify({ error: err.message, code: err.code }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (err instanceof ScrapeError) {
      console.error("[recipes/import] Scrape failed", { code: err.code, message: err.message });
      const nextMode = nextModeFor(mode);
      const message = err.code === "SCRAPE_BLOCKED"
        ? "This website blocks automated access. Try copying the recipe text and using paste import instead."
        : err.code === "SCRAPE_CONFIG_MISSING"
          ? "Browser rendering fallback is not configured on the server."
          : `Could not read the page: ${err.message}`;
      return new Response(
        JSON.stringify({
          error: message,
          code: err.code,
          ...(err.code === "SCRAPE_BLOCKED" && nextMode ? { nextMode } : {}),
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }

    const normalized = toAiClientError(err);
    console.error("[recipes/import] AI request failed", {
      code: normalized.code,
      details: normalized.details,
    });

    return new Response(
      JSON.stringify({ error: normalized.message, code: normalized.code }),
      {
        status: normalized.status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
