import { z } from "zod";
import { apiError, json } from "@/lib/http";
import { getSupabaseAuthClient } from "@/lib/supabase";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200)
});

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const { data, error } = await getSupabaseAuthClient().auth.signInWithPassword(input);
    if (error || !data.session) {
      return json({ error: "E-mail ou senha incorretos." }, { status: 401 });
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
