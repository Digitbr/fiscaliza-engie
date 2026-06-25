import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  // The placeholder lets Next.js collect route metadata during a build that
  // does not have runtime secrets. Queries still fail clearly until configured.
  const connectionString = process.env.DATABASE_URL
    ?? process.env.MYSQL_URL
    ?? "mysql://root:password@127.0.0.1:3306/fiscaliza_engie";

  const adapter = new PrismaMariaDb(connectionString);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
