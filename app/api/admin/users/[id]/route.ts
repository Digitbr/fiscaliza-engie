import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser, requireRole, ForbiddenError } from "@/lib/auth";
import { apiError, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  role: z.enum(["ADMIN", "MANAGER", "SUPERVISOR", "INSPECTOR", "VIEWER"]).optional(),
  active: z.boolean().optional(),
  permissions: z.record(z.string(), z.boolean()).optional(),
  password: z.string().min(8).max(72).optional()
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireApiUser(request);
    requireRole(actor, ["ADMIN"]);
    const { id } = await context.params;
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return json({ error: "Usuário não encontrado." }, { status: 404 });
    if (target.isDeveloper && !actor.isDeveloper) {
      throw new ForbiddenError("O operador programador só pode ser alterado por ele mesmo.");
    }
    const input = updateSchema.parse(await request.json());
    if (input.password && target.supabaseAuthId) {
      const { error } = await getSupabaseAdmin().auth.admin.updateUserById(
        target.supabaseAuthId,
        { password: input.password }
      );
      if (error) throw error;
    }
    const requestedData = { ...input };
    delete requestedData.password;
    const data = target.isDeveloper
      ? {
          ...requestedData,
          role: "ADMIN" as const,
          active: true,
          permissions: Object.fromEntries([
            "dashboard", "inspections", "kilometers", "records",
            "scales", "employees", "notices", "users", "editRecords", "deleteRecords"
          ].map((permission) => [permission, true]))
        }
      : requestedData;
    const user = await prisma.user.update({ where: { id }, data });
    return json({ data: user });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireApiUser(request);
    requireRole(actor, ["ADMIN"]);
    const { id } = await context.params;
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return json({ error: "Usuário não encontrado." }, { status: 404 });
    if (target.isDeveloper || target.id === actor.id) {
      throw new ForbiddenError("Este usuário protegido não pode ser removido.");
    }
    if (target.supabaseAuthId) {
      const { error } = await getSupabaseAdmin().auth.admin.deleteUser(target.supabaseAuthId);
      if (error) throw error;
    }
    await prisma.user.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
