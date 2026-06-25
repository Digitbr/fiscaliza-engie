import { z } from "zod";
import { apiError, json } from "@/lib/http";
import { createAuthTokens, verifyPassword } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200)
});

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const user = await prisma.user.findFirst({
      where: { email: input.email.toLowerCase() }
    });

    if (!user?.active || !await verifyPassword(input.password, user.passwordHash)) {
      return json({ error: "E-mail ou senha incorretos." }, { status: 401 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return json(createAuthTokens(user));
  } catch (error) {
    return apiError(error);
  }
}
