import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

function migrationUrl() {
  const value = process.env.DIRECT_URL
    ?? process.env.POSTGRES_URL_NON_POOLING
    ?? process.env.DATABASE_URL
    ?? process.env.POSTGRES_PRISMA_URL
    ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder";

  if (process.env.PRISMA_ACCEPT_INVALID_CERTS !== "true") return value;
  const url = new URL(value);
  url.searchParams.set("sslaccept", "accept_invalid_certs");
  return url.toString();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  },
  datasource: {
    // Prisma CLI/migrations use the session/direct pooler, never transaction mode.
    // A placeholder permits `prisma generate` and `prisma validate` before secrets exist.
    url: migrationUrl()
  }
});
