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

async function routeContext(
  context: { params: Promise<{ resource: string; id: string }> }
) {
  const params = await context.params;
  return {
    id: params.id,
    resource: resolveResource(params.resource)
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const actor = await requireApiUser(request);
    const { id, resource } = await routeContext(context);
    if (!resource) return json({ error: "Recurso não encontrado." }, { status: 404 });
    if (resource === "users") {
      requireRole(actor, ["ADMIN", "MANAGER"]);
    }

    const record = await getDelegate(resource).findUnique({ where: { id } });
    return record
      ? json({ data: record })
      : json({ error: "Registro não encontrado." }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const actor = await requireApiUser(request);
    const { id, resource } = await routeContext(context);
    if (!resource) return json({ error: "Recurso não encontrado." }, { status: 404 });
    requireRole(actor, ["ADMIN", "MANAGER", "SUPERVISOR", "INSPECTOR"]);
    if (resource === "users") {
      requireRole(actor, ["ADMIN"]);
    }

    const delegate = getDelegate(resource);
    const before = await delegate.findUnique({ where: { id } });
    if (!before) return json({ error: "Registro não encontrado." }, { status: 404 });

    const data = resourceSchemas[resource].partial().parse(await request.json());
    const updated = await delegate.update({ where: { id }, data });
    await writeAuditLog({
      actorUserId: actor.id,
      action: "UPDATE",
      entity: resource,
      entityId: id,
      before,
      after: updated,
      request
    });

    return json({ data: updated });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const actor = await requireApiUser(request);
    const { id, resource } = await routeContext(context);
    if (!resource) return json({ error: "Recurso não encontrado." }, { status: 404 });
    requireRole(actor, ["ADMIN", "MANAGER"]);

    const delegate = getDelegate(resource);
    const before = await delegate.findUnique({ where: { id } });
    if (!before) return json({ error: "Registro não encontrado." }, { status: 404 });

    await delegate.delete({ where: { id } });
    await writeAuditLog({
      actorUserId: actor.id,
      action: "DELETE",
      entity: resource,
      entityId: id,
      before,
      request
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
