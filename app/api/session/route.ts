import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { apiError, json } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser(request);
    return json({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        label: user.isDeveloper ? "Operador programador" : user.role,
        permissions: user.permissions ?? {},
        isDeveloper: user.isDeveloper
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
