import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser, requireRole } from "@/lib/auth";
import { apiError, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const appDataSchema = z.object({
  records: z.array(z.record(z.string(), z.unknown())).default([]),
  kmRecords: z.array(z.record(z.string(), z.unknown())).default([]),
  notices: z.array(z.record(z.string(), z.unknown())).default([]),
  scales: z.array(z.record(z.string(), z.unknown())).default([])
});

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request);
    const state = await prisma.operationalState.findUnique({ where: { id: "main" } });
    return json({ data: state?.data ?? null, version: state?.version ?? 0 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await requireApiUser(request);
    requireRole(actor, ["ADMIN", "MANAGER", "SUPERVISOR", "INSPECTOR"]);
    const data = appDataSchema.parse(await request.json());
    const jsonData = JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
    const state = await prisma.operationalState.upsert({
      where: { id: "main" },
      update: { data: jsonData, updatedBy: actor.id, version: { increment: 1 } },
      create: { id: "main", data: jsonData, updatedBy: actor.id }
    });
    return json({ data: state.data, version: state.version });
  } catch (error) {
    return apiError(error);
  }
}
