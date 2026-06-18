import { z } from "zod";

const optionalText = z.string().trim().max(5000).optional().nullable();
const uuid = z.string().uuid();
const metadata = z.record(z.string(), z.unknown()).optional().nullable();

export const resourceSchemas = {
  clients: z.object({
    legalName: z.string().trim().min(2).max(200),
    tradeName: z.string().trim().max(200).optional().nullable(),
    document: z.string().trim().max(30).optional().nullable(),
    contractCode: z.string().trim().max(80).optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone: z.string().trim().max(30).optional().nullable(),
    active: z.boolean().optional(),
    metadata
  }),
  posts: z.object({
    clientId: uuid,
    code: z.string().trim().min(1).max(50),
    name: z.string().trim().min(2).max(200),
    description: optionalText,
    address: z.string().trim().max(300).optional().nullable(),
    city: z.string().trim().max(100).optional().nullable(),
    state: z.string().trim().length(2).toUpperCase().optional().nullable(),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    timezone: z.string().trim().max(80).optional(),
    active: z.boolean().optional(),
    metadata
  }),
  collaborators: z.object({
    postId: uuid.optional().nullable(),
    registration: z.string().trim().max(50).optional().nullable(),
    name: z.string().trim().min(2).max(200),
    email: z.string().email().optional().nullable(),
    phone: z.string().trim().max(30).optional().nullable(),
    jobTitle: z.string().trim().max(120).optional().nullable(),
    active: z.boolean().optional(),
    hiredAt: z.coerce.date().optional().nullable(),
    metadata
  }),
  users: z.object({
    supabaseAuthId: uuid.optional().nullable(),
    clientId: uuid.optional().nullable(),
    collaboratorId: uuid.optional().nullable(),
    email: z.string().email(),
    name: z.string().trim().min(2).max(200),
    role: z.enum(["ADMIN", "MANAGER", "SUPERVISOR", "INSPECTOR", "VIEWER"]).optional(),
    active: z.boolean().optional()
  }),
  checklists: z.object({
    clientId: uuid.optional().nullable(),
    name: z.string().trim().min(2).max(200),
    description: optionalText,
    version: z.coerce.number().int().positive().optional(),
    active: z.boolean().optional()
  }),
  "checklist-items": z.object({
    checklistId: uuid,
    parentId: uuid.optional().nullable(),
    code: z.string().trim().min(1).max(50),
    title: z.string().trim().min(2).max(300),
    description: optionalText,
    type: z.enum([
      "BOOLEAN", "TEXT", "NUMBER", "SINGLE_CHOICE",
      "MULTIPLE_CHOICE", "PHOTO", "SIGNATURE"
    ]).optional(),
    required: z.boolean().optional(),
    position: z.coerce.number().int().nonnegative(),
    options: metadata,
    weight: z.coerce.number().nonnegative().optional().nullable(),
    active: z.boolean().optional()
  }),
  inspections: z.object({
    postId: uuid,
    checklistId: uuid,
    createdById: uuid.optional(),
    inspectorCollaboratorId: uuid.optional().nullable(),
    approvedById: uuid.optional().nullable(),
    reference: z.string().trim().min(3).max(100),
    status: z.enum([
      "DRAFT", "IN_PROGRESS", "COMPLETED", "APPROVED", "REJECTED", "CANCELED"
    ]).optional(),
    shift: z.enum(["DAY", "NIGHT", "OTHER"]).optional(),
    scheduledAt: z.coerce.date().optional().nullable(),
    startedAt: z.coerce.date().optional().nullable(),
    completedAt: z.coerce.date().optional().nullable(),
    approvedAt: z.coerce.date().optional().nullable(),
    score: z.coerce.number().min(0).optional().nullable(),
    notes: optionalText,
    metadata
  }),
  responses: z.object({
    inspectionId: uuid,
    checklistItemId: uuid,
    status: z.enum([
      "COMPLIANT", "NON_COMPLIANT", "NOT_APPLICABLE", "NOT_ANSWERED"
    ]).optional(),
    valueText: optionalText,
    valueNumber: z.coerce.number().optional().nullable(),
    valueBoolean: z.boolean().optional().nullable(),
    valueJson: metadata,
    comment: optionalText,
    answeredAt: z.coerce.date().optional().nullable()
  }),
  evidences: z.object({
    inspectionId: uuid,
    responseId: uuid.optional().nullable(),
    occurrenceId: uuid.optional().nullable(),
    type: z.enum(["PHOTO", "VIDEO", "AUDIO", "DOCUMENT", "SIGNATURE"]).optional(),
    bucket: z.string().trim().min(1).max(100).optional(),
    storagePath: z.string().trim().min(3).max(1000),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(3).max(150),
    sizeBytes: z.coerce.bigint().nonnegative().optional().nullable(),
    checksum: z.string().trim().max(200).optional().nullable(),
    caption: optionalText,
    capturedAt: z.coerce.date().optional().nullable(),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable()
  }),
  occurrences: z.object({
    inspectionId: uuid,
    reportedById: uuid.optional(),
    code: z.string().trim().min(3).max(100),
    title: z.string().trim().min(2).max(250),
    description: z.string().trim().min(3).max(10000),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    status: z.enum(["OPEN", "IN_ANALYSIS", "RESOLVED", "DISMISSED"]).optional(),
    detectedAt: z.coerce.date().optional(),
    resolvedAt: z.coerce.date().optional().nullable(),
    resolution: optionalText
  }),
  "action-plans": z.object({
    occurrenceId: uuid,
    assignedToId: uuid.optional().nullable(),
    title: z.string().trim().min(2).max(250),
    description: z.string().trim().min(3).max(10000),
    status: z.enum(["OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELED"]).optional(),
    priority: z.coerce.number().int().min(1).max(5).optional(),
    dueAt: z.coerce.date().optional().nullable(),
    startedAt: z.coerce.date().optional().nullable(),
    completedAt: z.coerce.date().optional().nullable(),
    completionNotes: optionalText
  })
} as const;

export type ResourceName = keyof typeof resourceSchemas;

export const resourceNames = new Set<ResourceName>(
  Object.keys(resourceSchemas) as ResourceName[]
);

export const uploadRequestSchema = z.object({
  inspectionId: uuid,
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().regex(
    /^(image|video|audio|application)\//,
    "Tipo de arquivo não permitido."
  ),
  bucket: z.string().trim().min(1).max(100).default("evidencias")
});
