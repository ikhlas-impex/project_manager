import { requireUser, supabaseAdmin, json } from "@/lib/server";
import { buildMime, gmailSend, googleConfigured, refreshAccessToken } from "@/lib/google";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const renderHtml = (subject, text, sender) => `<div style="font-family:Segoe UI,Arial,sans-serif;background:#f4f2ff;padding:24px">
  <div style="max-width:640px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6e1ff">
    <div style="background:linear-gradient(90deg,#8b5cf6,#6366f1);color:#fff;padding:18px 24px;font-size:18px;font-weight:600">${esc(subject)}</div>
    <div style="padding:24px;white-space:pre-wrap;line-height:1.6;color:#1f1b3a;font-size:14px">${esc(text)}</div>
    <div style="padding:12px 24px;background:#faf9ff;color:#8a84a8;font-size:12px">Sent by ${esc(sender)} via TeamFlow</div>
  </div></div>`;

// Sends from the user's own connected Gmail (Google OAuth + Gmail API).
export async function POST(req) {
  const auth = await requireUser(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const { to, toUserIds, subject, text } = await req.json();
  if (!subject || !text) return json({ error: "Subject and message are required." }, 400);

  const recipients = new Set(
    String(to || "")
      .split(/[,;\s]+/)
      .filter(Boolean)
  );
  if (Array.isArray(toUserIds) && toUserIds.length) {
    const { data } = await auth.sb.from("profiles").select("notify_email").in("id", toUserIds);
    data?.forEach((p) => p.notify_email && recipients.add(p.notify_email));
  }
  const list = [...recipients].filter((e) => EMAIL_RE.test(e)).slice(0, 20);
  if (!list.length) return json({ error: "No valid recipient. Ask them to add their Gmail in Profile." }, 400);

  const { data: me } = await auth.sb.from("profiles").select("full_name, notify_email").eq("id", auth.user.id).single();
  const sender = me?.full_name || "TeamFlow";
  const cleanSubject = String(subject).slice(0, 200);
  const html = renderHtml(cleanSubject, text, sender);

  if (!googleConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Google is not configured on the server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)." }, 503);
  }
  const admin = supabaseAdmin();
  const { data: google } = await admin.from("google_accounts").select("email, refresh_token").eq("user_id", auth.user.id).maybeSingle();
  if (!google) return json({ error: "Connect your Gmail in Profile to send emails." }, 400);

  try {
    const accessToken = await refreshAccessToken(google.refresh_token);
    const raw = buildMime({ fromName: sender, fromEmail: google.email, to: list, subject: cleanSubject, text, html });
    await gmailSend(accessToken, raw);
    return json({ ok: true, sent: list.length, from: google.email });
  } catch (e) {
    if (e.code === "invalid_grant") {
      // access was revoked or expired: clear it so the UI asks to reconnect
      await admin.from("google_accounts").delete().eq("user_id", auth.user.id);
      await admin.from("profiles").update({ gmail_address: null }).eq("id", auth.user.id);
      return json({ error: "Your Gmail connection expired. Reconnect Gmail in Profile." }, 401);
    }
    return json({ error: `Gmail rejected the message: ${e.message}` }, 502);
  }
}
