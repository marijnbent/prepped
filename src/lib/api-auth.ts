import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./schema";

type AppUser = NonNullable<App.Locals["user"]>;

export function hashApiToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function maskApiToken(token: string) {
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

export function createApiToken() {
  const token = `ppd_${randomBytes(24).toString("base64url")}`;

  return {
    token,
    hash: hashApiToken(token),
    preview: maskApiToken(token),
  };
}

function readBearerToken(request: Request) {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header) return null;

  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) return null;

  return token.trim();
}

export function isBearerAuthRequest(request: Request) {
  return Boolean(readBearerToken(request));
}

export async function getUserFromApiToken(request: Request): Promise<AppUser | null> {
  const token = readBearerToken(request);
  if (!token) return null;

  const user = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.apiTokenHash, hashApiToken(token)))
    .get();

  if (!user) return null;

  db.update(users)
    .set({
      apiTokenLastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .run();

  return user;
}

export async function getRequestUser(request: Request, locals: App.Locals): Promise<AppUser | null> {
  if (locals.user) return locals.user;
  return getUserFromApiToken(request);
}
