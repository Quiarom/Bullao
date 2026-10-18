import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";

describe("Better Auth server", () => {
  let auth: (typeof import("@/server/auth.server"))["auth"];
  let sqlite: (typeof import("@/server/db.server"))["sqlite"];
  const origin = "http://localhost:8081";
  const dbPath = join(tmpdir(), `bullao-auth-${randomUUID()}.sqlite`);

  beforeAll(async () => {
    process.env["DATABASE_PATH"] = dbPath;
    process.env["BETTER_AUTH_URL"] = origin;
    process.env["BETTER_AUTH_SECRET"] = "integration-test-secret-at-least-32-characters";
    process.env["NODE_ENV"] = "production";
    ({ auth } = await import("@/server/auth.server"));
    ({ sqlite } = await import("@/server/db.server"));
  });

  afterAll(() => {
    sqlite?.close();
    for (const suffix of ["", "-shm", "-wal"]) {
      const path = `${dbPath}${suffix}`;
      if (existsSync(path)) unlinkSync(path);
    }
  });

  it("signs up email users, creates guest sessions, and serves issuer keys", async () => {
    const base = `${origin}/api/auth`;
    const signup = await auth.handler(
      new Request(`${base}/sign-up/email`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({
          email: `auth-${randomUUID()}@example.test`,
          password: "password-test-123",
          name: "Test User",
        }),
      }),
    );
    expect(signup.status).toBe(200);
    const cookie = signup.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toBeTruthy();
    const session = await auth.handler(
      new Request(`${base}/get-session`, { headers: { cookie: cookie!, origin } }),
    );
    expect(session.status).toBe(200);
    expect(
      ((await session.json()) as { user?: { isAnonymous?: boolean } }).user?.isAnonymous,
    ).toBeFalsy();

    const clientRegistration = await auth.handler(
      new Request(`${base}/oauth2/register`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "Bullao MCP test",
          application_type: "native",
          redirect_uris: ["http://127.0.0.1:9999/callback"],
          grant_types: ["authorization_code"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
          scope: "accounts:read",
          resources: [`${origin}/mcp`],
        }),
      }),
    );
    expect(clientRegistration.status, await clientRegistration.clone().text()).toBe(201);
    const client = (await clientRegistration.json()) as { client_id: string };
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const authorizeURL = new URL(`${base}/oauth2/authorize`);
    authorizeURL.search = new URLSearchParams({
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: "http://127.0.0.1:9999/callback",
      scope: "accounts:read",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "test-state",
      resource: `${origin}/mcp`,
    }).toString();
    const { handleAuthRequest } = await import("@/routes/api/auth/$");
    const authorize = await handleAuthRequest(
      new Request(authorizeURL, { headers: { origin, cookie: cookie!, accept: "text/html" } }),
    );
    expect(authorize.status, await authorize.clone().text()).toBe(302);
    const consentURL = new URL(authorize.headers.get("location")!, origin);
    expect(consentURL.pathname).toBe("/.lovable/oauth/consent");
    const consent = await (
      await import("@/routes/api/auth/$")
    ).handleAuthRequest(
      new Request(`${base}/oauth2/consent`, {
        method: "POST",
        headers: { origin, cookie: cookie!, "content-type": "application/json" },
        body: JSON.stringify({ accept: true, oauth_query: consentURL.search.slice(1) }),
      }),
    );
    expect(consent.status, await consent.clone().text()).toBe(200);
    const consentResult = (await consent.json()) as { url: string };
    expect(consentResult.url).toBeTruthy();
    const callbackURL = new URL(consentResult.url);
    const tokenForm = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: client.client_id,
      redirect_uri: "http://127.0.0.1:9999/callback",
      code: callbackURL.searchParams.get("code")!,
      code_verifier: verifier,
      resource: `${origin}/mcp`,
    });
    const tokenResponse = await auth.handler(
      new Request(`${base}/oauth2/token`, {
        method: "POST",
        headers: { origin, "content-type": "application/x-www-form-urlencoded" },
        body: tokenForm,
      }),
    );
    expect(tokenResponse.status, await tokenResponse.clone().text()).toBe(200);
    const tokens = (await tokenResponse.json()) as { access_token: string; scope: string };
    const keyResponse = await auth.handler(new Request(`${base}/jwks`));
    const keySet = (await keyResponse.json()) as JSONWebKeySet;
    const { payload: claims } = await jwtVerify(tokens.access_token, createLocalJWKSet(keySet), {
      issuer: `${origin}/api/auth`,
      audience: `${origin}/mcp`,
    });
    expect(claims.iss).toBe(`${origin}/api/auth`);
    expect(claims.aud).toContain(`${origin}/mcp`);
    expect(claims["scope"]).toContain("accounts:read");

    const signout = await auth.handler(
      new Request(`${base}/sign-out`, {
        method: "POST",
        headers: { origin, cookie: cookie!, "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(signout.status).toBe(200);
    const revoked = await auth.handler(
      new Request(`${base}/get-session`, { headers: { cookie: cookie!, origin } }),
    );
    expect(await revoked.json()).toBeNull();

    const guest = await auth.handler(
      new Request(`${base}/sign-in/anonymous`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(guest.status).toBe(200);
    expect(
      ((await guest.clone().json()) as { user?: { isAnonymous?: boolean } }).user?.isAnonymous,
    ).toBe(true);
    const guestCookie = guest.headers.get("set-cookie")?.split(";")[0];
    const guestConsent = await handleAuthRequest(
      new Request(`${base}/oauth2/consent`, {
        method: "POST",
        headers: { origin, cookie: guestCookie!, "content-type": "application/json" },
        body: JSON.stringify({ accept: true, oauth_query: "code=ignored" }),
      }),
    );
    expect(guestConsent.status).toBe(403);

    const metadata = await auth.handler(
      new Request(`${origin}/.well-known/oauth-authorization-server/api/auth`),
    );
    expect(metadata.status).toBe(200);
    const metadataBody = (await metadata.json()) as { issuer?: string; jwks_uri?: string };
    expect(metadataBody.issuer).toBe(`${origin}/api/auth`);
    expect(metadataBody.jwks_uri).toContain("jwks");
    const jwks = await auth.handler(new Request(`${base}/jwks`));
    expect(jwks.status).toBe(200);
  });
});
