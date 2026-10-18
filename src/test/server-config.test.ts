import { describe, expect, it } from "vitest";
import { serverConfig } from "@/server/config.server";

const secret = "test-only-" + "x".repeat(40);
describe("server configuration", () => {
  it("requires an explicit origin and strong secret in production", () => {
    expect(() => serverConfig({}, true)).toThrow("Production requires");
    expect(() => serverConfig({ BETTER_AUTH_URL: "https://example.test", BETTER_AUTH_SECRET: "short" }, true)).toThrow();
    expect(serverConfig({ BETTER_AUTH_URL: " https://example.test/ ", BETTER_AUTH_SECRET: secret }, true).baseURL).toBe("https://example.test");
  });
  it.each(["http://example.test", "https://user:pass@example.test", "https://example.test/path", "https://example.test?redirect=x", "ftp://localhost"])("rejects unsafe origin %s", (baseURL) => {
    expect(() => serverConfig({ BETTER_AUTH_URL: baseURL, BETTER_AUTH_SECRET: secret }, true)).toThrow();
  });
  it("permits HTTP loopback for local production testing", () => {
    expect(serverConfig({ BETTER_AUTH_URL: "http://localhost:8086", BETTER_AUTH_SECRET: secret }, true).baseURL).toBe("http://localhost:8086");
  });
});
