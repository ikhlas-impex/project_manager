import { json } from "@/lib/server";
import {
  ADMIN_COOKIE_NAME,
  getAdminPassword,
  signAdminToken,
  verifyAdminRequest,
} from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const password = String(body.password || "").trim();

  const expected = getAdminPassword();

  if (!password || password !== expected) {
    return json({ error: "Invalid administrative password" }, 401);
  }

  const token = signAdminToken();

  // Set HTTP-only secure cookie
  const isSecure = process.env.NODE_ENV === "production";
  const cookieValue = `${ADMIN_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
    7 * 24 * 60 * 60
  }${isSecure ? "; Secure" : ""}`;

  return new Response(JSON.stringify({ ok: true, message: "Admin authenticated" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookieValue,
    },
  });
}

export async function GET(req) {
  const authenticated = verifyAdminRequest(req);
  return json({ authenticated });
}

export async function DELETE() {
  const cookieValue = `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookieValue,
    },
  });
}
