const FORM_CONTENT_TYPES = ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"];

export function isCrossSiteForm(request: Request, url: URL): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;
  if (request.headers.get("origin") === url.origin) return false;
  const contentType = request.headers.get("content-type")?.toLowerCase();
  return !contentType || FORM_CONTENT_TYPES.some((type) => contentType.includes(type));
}
