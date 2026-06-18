import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseAuthClient } from "@/lib/supabase";

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

type AppUser = Awaited<ReturnType<typeof requireApiUser>>;

export function requireRole(user: AppUser, roles: AppUser["role"][]) {
  if (!roles.includes(user.role)) {
    throw new ForbiddenError("Perfil sem permissão para esta operação.");
  }
}

export async function requireApiUser(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token) throw new UnauthorizedError("Token Bearer ausente.");

  const { data, error } = await getSupabaseAuthClient().auth.getUser(token);
  if (error || !data.user?.email) {
    throw new UnauthorizedError("Sessão Supabase inválida.");
  }

  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { supabaseAuthId: data.user.id },
        { email: { equals: data.user.email, mode: "insensitive" } }
      ]
    }
  });

  if (!user || !user.active) {
    throw new ForbiddenError("Usuário sem acesso ao sistema.");
  }

  if (!user.supabaseAuthId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { supabaseAuthId: data.user.id, lastLoginAt: new Date() }
    });
  }

  return user;
}
