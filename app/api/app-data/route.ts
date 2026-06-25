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
  scales: z.array(z.record(z.string(), z.unknown())).default([]),
  teams: z.array(z.string()).default([]),
  employees: z.array(z.record(z.string(), z.unknown())).default([])
});

type AppData = z.infer<typeof appDataSchema>;

const mergeableArrays: (keyof AppData)[] = [
  "records",
  "kmRecords",
  "notices",
  "scales",
  "employees"
];

function recordKey(item: Record<string, unknown>, fallbackPrefix: string, index: number) {
  return String(item.id ?? item.email ?? item.name ?? `${fallbackPrefix}-${index}`);
}

function mergeByKey(
  current: Record<string, unknown>[],
  incoming: Record<string, unknown>[],
  key: keyof AppData
) {
  const merged = new Map<string, Record<string, unknown>>();
  current.forEach((item, index) => merged.set(recordKey(item, String(key), index), item));
  incoming.forEach((item, index) => merged.set(recordKey(item, String(key), index), item));
  return Array.from(merged.values());
}

function mergeAppData(currentData: unknown, incomingData: AppData) {
  const current = appDataSchema.parse(currentData ?? {});
  const merged: AppData = {
    ...current,
    ...incomingData,
    teams: incomingData.teams.length ? incomingData.teams : current.teams
  };

  for (const key of mergeableArrays) {
    merged[key] = mergeByKey(
      current[key] as Record<string, unknown>[],
      incomingData[key] as Record<string, unknown>[],
      key
    ) as never;
  }

  return merged;
}

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
    const current = await prisma.operationalState.findUnique({ where: { id: "main" } });
    const baseVersion = Number(request.headers.get("x-app-data-version") || 0);
    const shouldReplace = !current || baseVersion === current.version;
    const nextData = shouldReplace ? data : mergeAppData(current.data, data);
    const jsonData = JSON.parse(JSON.stringify(nextData)) as Prisma.InputJsonValue;
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
