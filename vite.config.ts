import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of ["DATABASE_PATH", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET", "LOVABLE_API_KEY"]) {
    if (process.env[key] === undefined && env[key] !== undefined) process.env[key] = env[key];
  }
  return {
    server: { port: 8080, host: "127.0.0.1" },
    resolve: { tsconfigPaths: true },
    plugins: [tanstackStart(), nitro({ preset: "node-server" }), react(), tailwindcss()],
  };
});
