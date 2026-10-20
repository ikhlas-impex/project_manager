import { json, supabaseAdmin } from "@/lib/server";
import { googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

// Lets the UI know which integrations are configured (never exposes the keys).
export async function GET() {
  let ai = false;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // AI is available once the admin has added at least one active Gemini key
    const { count } = await supabaseAdmin().from("ai_keys").select("id", { count: "exact", head: true }).eq("is_active", true);
    ai = Boolean(count);
  }
  return json({
    google: googleConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    ai,
  });
}
