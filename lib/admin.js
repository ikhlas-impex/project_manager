import crypto from "node:crypto";

export const ADMIN_COOKIE_NAME = "teamflow_admin_auth";
export const DEFAULT_ADMIN_PASSWORD = "Ikhlas@123";

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

function getSecret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.GOOGLE_CLIENT_SECRET || "teamflow_admin_internal_secret";
}

// Signs a lightweight session token for admin authentication
export function signAdminToken() {
  const payload = {
    role: "admin",
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

// Verifies the admin token signature and expiration
export function verifyAdminToken(token) {
  if (!token) return false;
  const [body, sig] = String(token).split(".");
  if (!body || !sig) return false;

  const expected = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return false;
  }

  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    return data && data.role === "admin" && data.exp > Date.now();
  } catch {
    return false;
  }
}

// Helper to check admin status from an incoming Request
export function verifyAdminRequest(req) {
  // Check cookie first
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE_NAME}=([^;]+)`));
  const tokenFromCookie = match ? decodeURIComponent(match[1]) : null;
  if (tokenFromCookie && verifyAdminToken(tokenFromCookie)) return true;

  // Check Bearer token as fallback
  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (bearerToken && verifyAdminToken(bearerToken)) return true;

  return false;
}
