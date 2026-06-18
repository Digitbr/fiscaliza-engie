import { NextRequest } from "next/server";
import { requireApiUser, requireRole } from "@/lib/auth";
import { apiError, json } from "@/lib/http";
import { getDelegate, writeAuditLog } from "@/lib/resources";
import {
  resourceNames,
  resourceSchemas,
  type ResourceName
} from "@/lib/validation";

export const runtime = "nodejs";

function resolveResource(value: string): ResourceName | null {
  return resourceNames.has(value as ResourceName) ? value as ResourceName : null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> }
) {
  try {
    const actor = await requireApiUser(request);
    const { resource: rawResource } = await context.params;
    const resource = resolveResource(rawResource);
    if (!resource) return json({ error: "Recurso não encontrado." }, { status: 404 });
    if (resource === "users") {
      requireRole(actor, ["ADMIN", "MANAGER"]);
    }

    const limit = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get("limit")) || 50, 1),
      200
    );
    const records = await getDelegate(resource).findMany({
      take: limit,
      orderBy: { createdAt: "desc" }
    });
    return json({ data: records });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> }
) {
  try {
    const actor = await requireApiUser(request);
    const { resource: rawResource } = await context.params;
    const resource = resolveResource(rawResource);
    if (!resource) return json({ error: "Recurso não encontrado." }, { status: 404 });
    requireRole(actor, ["ADMIN", "MANAGER", "SUPERVISOR", "INSPECTOR"]);
    if (resource === "users") {
      requireRole(actor, ["ADMIN"]);
    }

    const parsed = resourceSchemas[resource].parse(await request.json());
    const data = resource === "inspections"
      ? { ...parsed, createdById: actor.id }
      : resource === "occurrences"
        ? { ...parsed, reportedById: actor.id }
        : parsed;
    const created = await getDelegate(resource).create({ data });
    const entityId = typeof created === "object" && created && "id" in created
      ? String(created.id)
      : undefined;

    await writeAuditLog({
      actorUserId: actor.id,
      action: "CREATE",
      entity: resource,
      entityId,
      after: created,
      request
    });

    return json({ data: created }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
