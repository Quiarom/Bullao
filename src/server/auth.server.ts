import { betterAuth, type BetterAuthOptions } from "better-auth";
import { anonymous, jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { getMigrations } from "better-auth/db/migration";
import { sqlite } from "./db.server";
import { config } from "./config.server";

const { baseURL, secret } = config;
const resource = new URL("/mcp", baseURL).toString();

const options = {
  database: sqlite,
  secret,
  baseURL,
  emailAndPassword: { enabled: true },
  plugins: [
    anonymous(),
    jwt(),
    oauthProvider({
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      resources: [resource],
      clientRegistrationDefaultResources: [resource],
      loginPage: "/auth",
      consentPage: "/.lovable/oauth/consent",
      scopes: ["openid", "profile", "email", "offline_access", "accounts:read"],
    }),
  ],
} satisfies BetterAuthOptions;

export const auth = betterAuth(options);
await (await getMigrations(options)).runMigrations();

export async function requireUser(
  headers: Headers,
): Promise<{ id: string; name: string; email: string; isAnonymous?: boolean }> {
  const session = await auth.api.getSession({ headers });
  if (!session) throw new Error("Unauthorized");
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    isAnonymous: "isAnonymous" in session.user ? Boolean(session.user.isAnonymous) : false,
  };
}
