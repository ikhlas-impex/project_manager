import { loginAuthUrl, googleConfigured, getAllowedDomains } from "@/lib/google";

export const runtime = "nodejs";

export async function GET(req) {
  const url = new URL(req.url);
  if (!googleConfigured()) {
    return Response.redirect(`${url.origin}/login?error=not_configured`, 302);
  }
  const domains = getAllowedDomains();
  const domainHint = domains.length > 0 && domains[0] !== "*" ? domains[0] : undefined;
  const target = loginAuthUrl(url.origin, domainHint);
  return Response.redirect(target, 302);
}
