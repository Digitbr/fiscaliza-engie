import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  return json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  });
}
