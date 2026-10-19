import { json } from "@/lib/server";

export const dynamic = "force-dynamic";

// Lets the UI know which integrations are configured (never exposes the keys).
export function GET() {
  return json({
    email: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
    ai: Boolean(process.env.GEMINI_API_KEY),
  });
}
