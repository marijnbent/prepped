import type { APIRoute } from "astro";
import { processAndSaveImage } from "../../../lib/images";

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const subdir = (formData.get("subdir") as string) || "recipes";

  if (!file) {
    return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
  }

  if (subdir !== "recipes" && subdir !== "cook-logs") {
    return new Response(JSON.stringify({ error: "Invalid subdir" }), { status: 400 });
  }

  try {
    const paths = await processAndSaveImage(file, subdir);
    return new Response(JSON.stringify(paths), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 });
  }
};
