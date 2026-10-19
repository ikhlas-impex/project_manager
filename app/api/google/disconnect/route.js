import { requireUser, supabaseAdmin, json } from "@/lib/server";
import { revokeToken } from "@/lib/google";

export const runtime = "nodejs";

export async function POST(req) {
  const auth = await requireUser(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const admin = supabaseAdmin();
  const { data } = await admin.from("google_accounts").select("refresh_token").eq("user_id", auth.user.id).maybeSingle();
  if (data) await revokeToken(data.refresh_token);
  await admin.from("google_accounts").delete().eq("user_id", auth.user.id);
  await admin.from("profiles").update({ gmail_address: null }).eq("id", auth.user.id);
  return json({ ok: true });
}
