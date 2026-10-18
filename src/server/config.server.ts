const developmentSecret = "bullao-local-development-only-change-before-deploy";

export function serverConfig(env: Record<string, string | undefined>, production: boolean) {
  const configuredURL = env["BETTER_AUTH_URL"]?.trim();
  const configuredSecret = env["BETTER_AUTH_SECRET"]?.trim();
  if (production && (!configuredURL || !configuredSecret || configuredSecret.length < 32 || configuredSecret === developmentSecret)) {
    throw new Error("Production requires BETTER_AUTH_URL and a random BETTER_AUTH_SECRET of at least 32 characters.");
  }
  const url = new URL(configuredURL || "http://localhost:8080");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash || (production && !loopback && url.protocol !== "https:")) {
    throw new Error("BETTER_AUTH_URL must be an origin; remote production requires HTTPS.");
  }
  return { baseURL: url.origin, secret: configuredSecret || developmentSecret };
}

export const config = serverConfig(process.env, process.env["NODE_ENV"] === "production" || import.meta.env.PROD);
