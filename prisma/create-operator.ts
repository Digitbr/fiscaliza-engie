import { config as loadEnv } from "dotenv";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/local-auth";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const [email, password, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ") || "Operador Programador";

if (!email || !password || password.length < 8) {
  throw new Error(
    'Uso: npm run operator:create -- "email@empresa.com" "senha-com-8-caracteres" "Nome do operador"'
  );
}

const databaseUrl = process.env.DATABASE_URL
  ?? process.env.MYSQL_URL
  ?? "mysql://root:password@127.0.0.1:3306/fiscaliza_engie";

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(databaseUrl)
});

const permissions = Object.fromEntries([
  "dashboard", "inspections", "kilometers", "records",
  "scales", "employees", "notices", "users", "editRecords", "deleteRecords"
].map((permission) => [permission, true]));

async function main() {
  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: await hashPassword(password),
      name,
      role: "ADMIN",
      active: true,
      isDeveloper: true,
      permissions
    },
    create: {
      passwordHash: await hashPassword(password),
      email,
      name,
      role: "ADMIN",
      active: true,
      isDeveloper: true,
      permissions
    }
  });

  console.info(`Operador programador criado: ${email}`);
}

main().finally(() => prisma.$disconnect());
