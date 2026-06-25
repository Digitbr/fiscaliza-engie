import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextRequest } from "next/server";
import { requireApiUser, requireRole } from "@/lib/auth";
import { apiError, json } from "@/lib/http";
import { uploadRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";

function safeFileName(fileName: string) {
  const extension = path.extname(fileName).toLowerCase().slice(0, 12);
  const base = path.basename(fileName, path.extname(fileName))
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "evidencia";
  return `${base}${extension}`;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireApiUser(request);
    requireRole(actor, ["ADMIN", "MANAGER", "SUPERVISOR", "INSPECTOR"]);
    const input = uploadRequestSchema.parse(await request.json());
    const storagePath = [
      input.inspectionId,
      actor.id,
      `${randomUUID()}-${safeFileName(input.fileName)}`
    ].join("/");

    return json({
      data: {
        bucket: input.bucket,
        path: storagePath,
        token: "",
        signedUrl: "",
        uploadUrl: `/uploads/${storagePath}`,
        local: true,
        mimeType: input.mimeType
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
