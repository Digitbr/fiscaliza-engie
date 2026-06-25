import { z } from "zod";
import { apiError, json } from "@/lib/http";
import { createAuthTokens, verifyAuthToken } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(1000)
});

export async function POST(request: Request) {
  try {
    const input = refreshSchema.parse(await request.json());
    const token = verifyAuthToken(input.refreshToken, "refresh");
    if (!token) {
      return json({ error: "Sessão expirada. Entre novamente para continuar." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: token.sub } });
    if (!user?.active) {
      return json({ error: "Sessão expirada. Entre novamente para continuar." }, { status: 401 });
    }

    return json(createAuthTokens(user));
  } catch (error) {
    return apiError(error);
  }
}
