import { z } from "zod";
import { defaultUserPermissions, findBootstrapUser } from "@/lib/bootstrap-users";
import { apiError, json } from "@/lib/http";
import { createAuthTokens, hashPassword, verifyPassword } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200)
});

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const email = input.email.trim().toLowerCase();
    const bootstrapUser = findBootstrapUser(email);
    const user = bootstrapUser
      ? await prisma.user.upsert({
          where: { email },
          update: {
            passwordHash: await hashPassword(bootstrapUser.password),
            name: bootstrapUser.name,
            role: bootstrapUser.role,
            active: true,
            isDeveloper: false,
            permissions: defaultUserPermissions(bootstrapUser.role)
          },
          create: {
            email,
            passwordHash: await hashPassword(bootstrapUser.password),
            name: bootstrapUser.name,
            role: bootstrapUser.role,
            active: true,
            isDeveloper: false,
            permissions: defaultUserPermissions(bootstrapUser.role)
          }
        })
      : await prisma.user.findUnique({ where: { email } });

    if (!user?.active || !await verifyPassword(input.password, user.passwordHash)) {
      return json({ error: "E-mail ou senha incorretos." }, { status: 401 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return json(createAuthTokens(user));
  } catch (error) {
    return apiError(error);
  }
}
