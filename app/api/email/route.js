import nodemailer from "nodemailer";
import { requireUser, json } from "@/lib/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export async function POST(req) {
  const auth = await requireUser(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return json({ error: "Gmail is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD." }, 503);
  }

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

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.replace(/\s/g, "") },
  });

  try {
    await transporter.sendMail({
      from: `"${sender.replace(/"/g, "")} · TeamFlow" <${GMAIL_USER}>`,
      replyTo: me?.notify_email || undefined,
      to: list.join(","),
      subject: String(subject).slice(0, 200),
      text,
      html: `<div style="font-family:Segoe UI,Arial,sans-serif;background:#f4f2ff;padding:24px">
  <div style="max-width:640px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6e1ff">
    <div style="background:linear-gradient(90deg,#8b5cf6,#6366f1);color:#fff;padding:18px 24px;font-size:18px;font-weight:600">${esc(subject)}</div>
    <div style="padding:24px;white-space:pre-wrap;line-height:1.6;color:#1f1b3a;font-size:14px">${esc(text)}</div>
    <div style="padding:12px 24px;background:#faf9ff;color:#8a84a8;font-size:12px">Sent by ${esc(sender)} via TeamFlow</div>
  </div></div>`,
    });
  } catch (e) {
    return json({ error: `Gmail rejected the message: ${e.message}` }, 502);
  }
  return json({ ok: true, sent: list.length });
}
