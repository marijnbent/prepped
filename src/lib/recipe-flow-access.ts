export function canReadFlow(recipe: { createdBy: string; isPublished: boolean }, userId?: string) {
  return recipe.isPublished || recipe.createdBy === userId;
}

export function isFlowSameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const expected = new URL(request.url);
  const protocol = request.headers.get("x-forwarded-proto");
  if (protocol === "https" || protocol === "http") expected.protocol = `${protocol}:`;
  return origin === expected.origin;
}
