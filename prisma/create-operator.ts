import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../generated/prisma/client";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const [email, password, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ") || "Operador Programador";

if (!email || !password || password.length < 8) {
  throw new Error(
    'Uso: npm run operator:create -- "email@empresa.com" "senha-com-8-caracteres" "Nome do operador"'
  );
}

const databaseUrl = process.env.DIRECT_URL
  ?? process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.POSTGRES_PRISMA_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!databaseUrl || !supabaseUrl || !serviceRole) {
  throw new Error("Configure DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
}

function adapterConfig(value: string) {
  if (process.env.PG_ACCEPT_INVALID_CERTS !== "true") {
    return { connectionString: value };
  }
  const url = new URL(value);
  url.searchParams.delete("sslmode");
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false }
  };
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(adapterConfig(databaseUrl))
});
const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  const { data: existing } = await supabase.auth.admin.listUsers();
  let authUser = existing.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase()
  );

  if (authUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: { name }
    });
    if (error) throw error;
    authUser = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });
    if (error) throw error;
    authUser = data.user;
  }

  await prisma.user.upsert({
    where: { email },
    update: {
      supabaseAuthId: authUser.id,
      name,
      role: "ADMIN",
      active: true,
      isDeveloper: true,
      permissions: Object.fromEntries([
        "dashboard", "inspections", "kilometers", "records",
        "scales", "notices", "users", "editRecords", "deleteRecords"
      ].map((permission) => [permission, true]))
    },
    create: {
      supabaseAuthId: authUser.id,
      email,
      name,
      role: "ADMIN",
      active: true,
      isDeveloper: true,
      permissions: Object.fromEntries([
        "dashboard", "inspections", "kilometers", "records",
        "scales", "notices", "users", "editRecords", "deleteRecords"
      ].map((permission) => [permission, true]))
    }
  });

  console.info(`Operador programador criado: ${email}`);
}

main().finally(() => prisma.$disconnect());
