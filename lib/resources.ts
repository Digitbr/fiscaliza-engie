import { prisma } from "@/lib/prisma";
import { toJsonSafe } from "@/lib/http";
import type { ResourceName } from "@/lib/validation";

type CrudDelegate = {
  findMany(args: object): Promise<unknown>;
  findUnique(args: object): Promise<unknown>;
  create(args: object): Promise<unknown>;
  update(args: object): Promise<unknown>;
  delete(args: object): Promise<unknown>;
};

const delegateNames: Record<ResourceName, string> = {
  clients: "client",
  posts: "post",
  collaborators: "collaborator",
  users: "user",
  checklists: "checklistTemplate",
  "checklist-items": "checklistItem",
  inspections: "inspection",
  responses: "inspectionResponse",
  evidences: "evidence",
  occurrences: "occurrence",
  "action-plans": "actionPlan"
};

export function getDelegate(resource: ResourceName): CrudDelegate {
  const delegates = prisma as unknown as Record<string, CrudDelegate>;
  return delegates[delegateNames[resource]];
}

export async function writeAuditLog(input: {
  actorUserId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  entity: ResourceName;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  request: Request;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before === undefined ? undefined : toJsonSafe(input.before) as never,
      after: input.after === undefined ? undefined : toJsonSafe(input.after) as never,
      ipAddress: input.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: input.request.headers.get("user-agent"),
      requestId: input.request.headers.get("x-vercel-id")
    }
  });
}
