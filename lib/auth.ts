import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from "@/lib/local-auth";

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

  const payload = verifyAuthToken(token, "access");
  if (!payload) throw new UnauthorizedError("Sessão inválida.");

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active) {
    throw new ForbiddenError("Usuário sem acesso ao sistema.");
  }

  return user;
}
