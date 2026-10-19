import { json } from "@/lib/server";
import { googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

// Lets the UI know which integrations are configured (never exposes the keys).
export function GET() {
  return json({
    google: googleConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    ai: Boolean(process.env.GEMINI_API_KEY),
  });
}
