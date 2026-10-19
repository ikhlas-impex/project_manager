import { requireUser, json } from "@/lib/server";
import { authUrl, googleConfigured } from "@/lib/google";

export const runtime = "nodejs";

// Returns the Google consent URL; the browser then navigates there.
export async function POST(req) {
  const auth = await requireUser(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);
  if (!googleConfigured()) return json({ error: "Google sign-in is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)." }, 503);
  return json({ url: authUrl(new URL(req.url).origin, auth.user.id) });
}
