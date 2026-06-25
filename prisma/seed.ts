import { config as loadEnv } from "dotenv";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/local-auth";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const connectionString = process.env.DATABASE_URL
  ?? process.env.MYSQL_URL
  ?? "mysql://root:password@127.0.0.1:3306/fiscaliza_engie";
if (!connectionString) {
  throw new Error("Configure DATABASE_URL antes de executar o seed.");
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(connectionString)
});

async function main() {
  const client = await prisma.client.upsert({
    where: { document: "SEED-ENGIE-ESOM" },
    update: {},
    create: {
      legalName: "ENGIE Soluções de Operação e Manutenção",
      tradeName: "ENGIE ESOM",
      document: "SEED-ENGIE-ESOM",
      contractCode: "AC380ESOM",
      email: "operacao@example.com"
    }
  });

  const posts = await Promise.all(
    [
      ["TIMS", "TAG Tims"],
      ["ITAPEMIRIM", "TAG Itapemirim"],
      ["VIANA", "TAG Viana"]
    ].map(([code, name]) =>
      prisma.post.upsert({
        where: { clientId_code: { clientId: client.id, code } },
        update: {},
        create: {
          clientId: client.id,
          code,
          name,
          state: "ES"
        }
      })
    )
  );

  const collaborator = await prisma.collaborator.upsert({
    where: { email: "supervisor@example.com" },
    update: {},
    create: {
      postId: posts[0].id,
      registration: "SEED-001",
      name: "Supervisor Operacional",
      email: "supervisor@example.com",
      jobTitle: "Supervisor"
    }
  });

  await prisma.user.upsert({
    where: { email: "operador@prime.local" },
    update: {
      role: "ADMIN",
      isDeveloper: true,
      passwordHash: await hashPassword("operadorprime26"),
      permissions: {
        dashboard: true,
        inspections: true,
        kilometers: true,
        records: true,
        scales: true,
        employees: true,
        notices: true,
        users: true,
        editRecords: true,
        deleteRecords: true
      }
    },
    create: {
      clientId: client.id,
      email: "operador@prime.local",
      name: "Operador Programador",
      role: "ADMIN",
      isDeveloper: true,
      passwordHash: await hashPassword("operadorprime26"),
      permissions: {
        dashboard: true,
        inspections: true,
        kilometers: true,
        records: true,
        scales: true,
        employees: true,
        notices: true,
        users: true,
        editRecords: true,
        deleteRecords: true
      }
    }
  });

  await prisma.user.upsert({
    where: { email: "supervisor@example.com" },
    update: {},
    create: {
      clientId: client.id,
      collaboratorId: collaborator.id,
      email: "supervisor@example.com",
      name: "Supervisor Operacional",
      role: "SUPERVISOR",
      passwordHash: await hashPassword("supervisor26")
    }
  });

  const checklist = await prisma.checklistTemplate.upsert({
    where: {
      clientId_name_version: {
        clientId: client.id,
        name: "Ronda Operacional ENGIE",
        version: 1
      }
    },
    update: {},
    create: {
      clientId: client.id,
      name: "Ronda Operacional ENGIE",
      description: "Checklist inicial para rondas operacionais.",
      version: 1
    }
  });

  const items = [
    {
      code: "HORARIO",
      title: "Horário da ronda registrado",
      type: "TEXT" as const,
      position: 1
    },
    {
      code: "OCORRENCIAS",
      title: "Existem ocorrências durante a ronda?",
      type: "BOOLEAN" as const,
      position: 2
    },
    {
      code: "EVIDENCIAS",
      title: "Evidências fotográficas anexadas",
      type: "PHOTO" as const,
      position: 3
    },
    {
      code: "OBSERVACOES",
      title: "Observações da fiscalização",
      type: "TEXT" as const,
      position: 4,
      required: false
    }
  ];

  for (const item of items) {
    await prisma.checklistItem.upsert({
      where: {
        checklistId_code: {
          checklistId: checklist.id,
          code: item.code
        }
      },
      update: {},
      create: {
        checklistId: checklist.id,
        ...item
      }
    });
  }

  console.info("Seed concluído.", {
    clientId: client.id,
    postIds: posts.map((post) => post.id),
    checklistId: checklist.id
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
