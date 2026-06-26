import { z } from "zod";
import { apiError, json } from "@/lib/http";
import { getSupabaseAuthClient } from "@/lib/supabase";

const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(1000)
});

export async function POST(request: Request) {
  try {
    const input = refreshSchema.parse(await request.json());
    const { data, error } = await getSupabaseAuthClient().auth.refreshSession({
      refresh_token: input.refreshToken
    });

    if (error || !data.session) {
      return json({ error: "Sessão expirada. Entre novamente para continuar." }, { status: 401 });
    }

    return json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at
    });
  } catch (error) {
    return apiError(error);
  }
}
