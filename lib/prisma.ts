import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  // The placeholder lets Next.js collect route metadata during a build that
  // does not have runtime secrets. Queries still fail clearly until configured.
  const connectionString = process.env.DATABASE_URL
    ?? process.env.POSTGRES_PRISMA_URL
    ?? process.env.POSTGRES_URL
    ?? "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder";
  const connectionUrl = new URL(connectionString);
  if (connectionUrl.searchParams.get("sslmode") === "require") {
    // pg v8 otherwise treats `require` as certificate verification (`verify-full`).
    // This keeps TLS enabled while following standard libpq/Supabase semantics.
    connectionUrl.searchParams.set("uselibpqcompat", "true");
  }

  const adapter = new PrismaPg({
    connectionString: connectionUrl.toString(),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 20_000,
    max: process.env.NODE_ENV === "production" ? 5 : 2
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
