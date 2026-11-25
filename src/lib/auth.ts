import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { ID_TOKEN_COOKIE, oidc, SSO_PROVIDER_ID } from "./oidc";
import * as schema from "./schema";
import { seedUserDefaults } from "./seed";

const day = 60 * 60 * 24;

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
  user: {
    additionalFields: {
      locale: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
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
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const session = ctx.context.newSession;
      if (!session || ctx.params?.id !== SSO_PROVIDER_ID) return;

      const { accounts } = schema;
      const account = db
        .select({ idToken: accounts.idToken })
        .from(accounts)
        .where(and(eq(accounts.userId, session.user.id), eq(accounts.providerId, SSO_PROVIDER_ID)))
        .get();
      if (!account?.idToken) return;

      const cookie = ctx.context.createAuthCookie(ID_TOKEN_COOKIE, { maxAge: 365 * day });
      ctx.setCookie(cookie.name, account.idToken, cookie.attributes);
    }),
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
