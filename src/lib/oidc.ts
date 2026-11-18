import { createRemoteJWKSet, jwtVerify } from "jose";

const LOGOUT_EVENT = "http://schemas.openid.net/event/backchannel-logout";

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

export const oidc = readOidc();
export const SSO_PROVIDER_ID = "oidc";
export const ID_TOKEN_COOKIE = "sso_id_token";

type Provider = {
  endSession?: string;
  keys?: ReturnType<typeof createRemoteJWKSet>;
};

let provider: Promise<Provider> | null = null;

function discover(issuer: string): Promise<Provider> {
  provider ??= fetch(`${issuer}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(10_000) })
    .then(async (response) => {
      if (!response.ok) throw new Error(`OIDC discovery failed with ${response.status}`);
      const document = (await response.json()) as { end_session_endpoint?: unknown; jwks_uri?: unknown };
      return {
        endSession: typeof document.end_session_endpoint === "string" ? document.end_session_endpoint : undefined,
        keys: typeof document.jwks_uri === "string" ? createRemoteJWKSet(new URL(document.jwks_uri)) : undefined,
      };
    })
    .catch((error: unknown) => {
      provider = null;
      throw error;
    });
  return provider;
}

export async function providerLogoutUrl(idToken: string | undefined, returnTo: string): Promise<string | null> {
  if (!oidc) return null;
  const endSession = await discover(oidc.issuer).then((found) => found.endSession, () => undefined);
  if (!endSession) return null;

  const url = new URL(endSession);
  url.searchParams.set("client_id", oidc.clientId);
  url.searchParams.set("post_logout_redirect_uri", returnTo);
  if (idToken) url.searchParams.set("id_token_hint", idToken);
  return url.href;
}

export async function readLogoutToken(token: string): Promise<string | null> {
  if (!oidc) return null;
  try {
    const { keys } = await discover(oidc.issuer);
    if (!keys) return null;
    const { payload } = await jwtVerify(token, keys, { issuer: oidc.issuer, audience: oidc.clientId });
    const events = payload.events;
    const isLogout = typeof events === "object" && events !== null && LOGOUT_EVENT in events;
    return isLogout && payload.nonce === undefined && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}
