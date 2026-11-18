import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
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
