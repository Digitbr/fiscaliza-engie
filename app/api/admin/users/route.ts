import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser, requireRole } from "@/lib/auth";
import { apiError, json } from "@/lib/http";
import { hashPassword } from "@/lib/local-auth";
import { prisma } from "@/lib/prisma";

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(2).max(200),
  role: z.enum(["ADMIN", "MANAGER", "SUPERVISOR", "INSPECTOR", "VIEWER"]),
  active: z.boolean().default(true),
  permissions: z.record(z.string(), z.boolean()).default({})
});

export async function GET(request: NextRequest) {
  try {
    const actor = await requireApiUser(request);
    requireRole(actor, ["ADMIN", "MANAGER"]);
    const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
    return json({ data: users });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireApiUser(request);
    requireRole(actor, ["ADMIN"]);
    const input = userSchema.parse(await request.json());
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        active: input.active,
        permissions: input.permissions,
        passwordHash: await hashPassword(input.password)
      }
    });
    return json({ data: user }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
