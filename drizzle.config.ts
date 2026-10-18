import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/events-schema.ts",
  out: "./drizzle/sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? "./data/bullao.sqlite",
  },
});
