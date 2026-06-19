import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser, requireRole, ForbiddenError } from "@/lib/auth";
import { apiError, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase";

const updateSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
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
    const emailChanged = Boolean(input.email && input.email !== target.email);

    if (emailChanged) {
      const existingUser = await prisma.user.findFirst({
        where: {
          id: { not: target.id },
          email: { equals: input.email, mode: "insensitive" }
        },
        select: { id: true }
      });
      if (existingUser) {
        return json({ error: "Este e-mail já está sendo usado por outro usuário." }, { status: 409 });
      }
    }

    let supabaseAuthId = target.supabaseAuthId;
    if (!supabaseAuthId && (emailChanged || input.password)) {
      if (!input.password) {
        return json({
          error: "Este usuário ainda não possui login. Informe uma senha inicial para ativá-lo."
        }, { status: 400 });
      }
      const { data: authData, error } = await getSupabaseAdmin().auth.admin.createUser({
        email: input.email || target.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { name: input.name || target.name }
      });
      if (error) throw error;
      supabaseAuthId = authData.user.id;
    } else if ((emailChanged || input.password) && supabaseAuthId) {
      const { error } = await getSupabaseAdmin().auth.admin.updateUserById(
        supabaseAuthId,
        {
          ...(emailChanged ? { email: input.email, email_confirm: true } : {}),
          ...(input.password ? { password: input.password } : {})
        }
      );
      if (error) {
        if (emailChanged && /already|registered|exists|duplicate/i.test(error.message)) {
          return json({ error: "Este e-mail já está vinculado a outro login." }, { status: 409 });
        }
        throw error;
      }
    }
    const { password: _password, ...editableData } = input;
    void _password;
    const requestedData = {
      ...editableData,
      ...(supabaseAuthId && !target.supabaseAuthId ? { supabaseAuthId } : {})
    };
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
    let user;
    try {
      user = await prisma.user.update({ where: { id }, data });
    } catch (error) {
      if (emailChanged && target.supabaseAuthId) {
        const { error: rollbackError } = await getSupabaseAdmin().auth.admin.updateUserById(
          target.supabaseAuthId,
          { email: target.email, email_confirm: true }
        );
        if (rollbackError) console.error("Falha ao restaurar o login no Supabase Auth.", rollbackError);
      }
      throw error;
    }
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
