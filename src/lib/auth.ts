import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import * as schema from "./schema";
import { seedUserDefaults } from "./seed";

const day = 60 * 60 * 24;

function readOidc() {
  const issuer = process.env.OIDC_ISSUER?.trim().replace(/\/$/, "");
  const clientId = process.env.OIDC_CLIENT_ID?.trim();
  const clientSecret = process.env.OIDC_CLIENT_SECRET?.trim();

  if (!issuer && !clientId && !clientSecret) return null;
  if (!issuer || !clientId || !clientSecret) {
    throw new Error("OIDC_ISSUER, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET must be set together");
  }

  return { issuer, clientId, clientSecret };
}

const oidc = readOidc();

function adoptNameOnlyAccount(profile: Record<string, unknown>): void {
  if (typeof profile.email !== "string" || profile.email_verified !== true || typeof profile.name !== "string") return;
  const email = profile.email.trim().toLowerCase();
  const { users } = schema;
  if (db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).get()) return;

  const fullName = profile.name.trim().toLowerCase();
  for (const name of new Set([fullName, fullName.split(/\s+/)[0]])) {
    const matches = db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.name}) = ${name} and ${users.email} like '%@family.local'`)
      .all();
    if (matches.length !== 1) continue;
    db.update(users).set({ email, emailVerified: true, updatedAt: new Date() }).where(eq(users.id, matches[0].id)).run();
    return;
  }
}

export const SSO_PROVIDER_ID = "oidc";
export const ssoEnabled = oidc !== null && import.meta.env.AUTH_MODE !== "simple";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: ssoEnabled,
  },
  account: {
    accountLinking: { requireLocalEmailVerified: false },
  },
  session: {
    expiresIn: 365 * day,
    updateAge: day,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  plugins: oidc
    ? [
        genericOAuth({
          config: [
            {
              providerId: SSO_PROVIDER_ID,
              clientId: oidc.clientId,
              clientSecret: oidc.clientSecret,
              discoveryUrl: `${oidc.issuer}/.well-known/openid-configuration`,
              scopes: ["openid", "profile", "email"],
              pkce: true,
              mapProfileToUser: (profile) => {
                adoptNameOnlyAccount(profile);
                return {};
              },
            },
          ],
        }),
      ]
    : [],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          seedUserDefaults(user.id, import.meta.env.PUBLIC_UI_LOCALE);
        },
      },
    },
  },
});
