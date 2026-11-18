import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const { privateKey, publicKey } = await generateKeyPair("RS256");
const server = createServer(async (request, response) => {
  const issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const body = request.url === "/jwks"
    ? { keys: [{ ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" }] }
    : { end_session_endpoint: `${issuer}/end`, jwks_uri: `${issuer}/jwks` };
  response.setHeader("content-type", "application/json").end(JSON.stringify(body));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

process.env.OIDC_ISSUER = issuer;
process.env.OIDC_CLIENT_ID = "recipes";
process.env.OIDC_CLIENT_SECRET = "secret";
const { providerLogoutUrl, readLogoutToken } = await import("../src/lib/oidc");

const logoutEvent = { "http://schemas.openid.net/event/backchannel-logout": {} };
const sign = (claims: Record<string, unknown>, audience = "recipes") =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject("user-1")
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(privateKey);

test.after(() => server.close());

test("logging out sends the browser to the provider with the ID token", async () => {
  const url = new URL((await providerLogoutUrl("token", "https://recipes.example/"))!);
  assert.equal(url.origin + url.pathname, `${issuer}/end`);
  assert.equal(url.searchParams.get("id_token_hint"), "token");
  assert.equal(url.searchParams.get("post_logout_redirect_uri"), "https://recipes.example/");
});

test("only a signed logout token for this app names a user to log out", async () => {
  assert.equal(await readLogoutToken(await sign({ events: logoutEvent })), "user-1");
  assert.equal(await readLogoutToken(await sign({ events: logoutEvent }, "other-app")), null);
  assert.equal(await readLogoutToken(await sign({})), null);
  assert.equal(await readLogoutToken(await sign({ events: logoutEvent, nonce: "n" })), null);
  assert.equal(await readLogoutToken("not-a-token"), null);
});
