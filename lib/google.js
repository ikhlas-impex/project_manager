// Server-only helpers for "Connect Gmail" (Google OAuth + Gmail API send).
import crypto from "node:crypto";

const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.send"];

export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const redirectUri = (origin) => `${origin}/api/google/callback`;

// The OAuth "state" carries the user id, signed so it can't be forged.
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", process.env.GOOGLE_CLIENT_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state) {
  const [body, sig] = String(state || "").split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", process.env.GOOGLE_CLIENT_SECRET).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(body, "base64url").toString());
  return data.exp > Date.now() ? data : null;
}

export function authUrl(origin, userId) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // gives us a refresh token
    prompt: "consent",
    state: sign({ uid: userId, exp: Date.now() + 10 * 60e3 }),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(fields) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      ...fields,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || "Google token error");
    err.code = data.error;
    throw err;
  }
  return data;
}

export const exchangeCode = (origin, code) =>
  tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri(origin) });

export const refreshAccessToken = (refreshToken) =>
  tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" }).then((d) => d.access_token);

export async function getGoogleEmail(accessToken) {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!data.email) throw new Error("Could not read Google account email");
  return data.email;
}

export const revokeToken = (token) =>
  fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => {});

// ---- MIME message for the Gmail API ----
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const wrap = (s) => s.replace(/.{1,76}/g, "$&\r\n");
const encodeHeader = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

export function buildMime({ fromName, fromEmail, to, replyTo, subject, text, html }) {
  const boundary = `tf_${crypto.randomBytes(12).toString("hex")}`;
  const lines = [
    `From: ${encodeHeader(fromName.replace(/["<>]/g, ""))} <${fromEmail}>`,
    `To: ${to.join(", ")}`,
    replyTo ? `Reply-To: ${replyTo}` : null,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(b64(text)),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(b64(html)),
    `--${boundary}--`,
  ];
  return Buffer.from(lines.filter((l) => l !== null).join("\r\n")).toString("base64url");
}

export async function gmailSend(accessToken, raw) {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Gmail API error (${res.status})`);
  return data;
}
