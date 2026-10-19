import { supabaseAdmin } from "@/lib/server";
import { exchangeCode, getGoogleEmail, verifyState } from "@/lib/google";

export const runtime = "nodejs";

// Google redirects here after the user approves access.
export async function GET(req) {
  const url = new URL(req.url);
  const back = (result) => Response.redirect(`${url.origin}/profile?gmail=${result}`, 302);

  if (url.searchParams.get("error")) return back("denied");
  const state = verifyState(url.searchParams.get("state"));
  if (!state) return back("expired");

  try {
    const tokens = await exchangeCode(url.origin, url.searchParams.get("code"));
    if (!tokens.scope?.includes("gmail.send")) return back("scope");
    const email = await getGoogleEmail(tokens.access_token);

    const admin = supabaseAdmin();
    const { data: existing } = await admin.from("google_accounts").select("refresh_token").eq("user_id", state.uid).maybeSingle();
    const refreshToken = tokens.refresh_token || existing?.refresh_token;
    if (!refreshToken) return back("error");

    const { error } = await admin
      .from("google_accounts")
      .upsert({ user_id: state.uid, email, refresh_token: refreshToken, updated_at: new Date().toISOString() });
    if (error) throw error;

    // Show the connection in the UI and use it for notifications if none is set
    const { data: profile } = await admin.from("profiles").select("notify_email").eq("id", state.uid).single();
    await admin
      .from("profiles")
      .update({ gmail_address: email, ...(profile?.notify_email ? {} : { notify_email: email }) })
      .eq("id", state.uid);

    return back("connected");
  } catch (e) {
    console.error("Gmail connect failed:", e);
    return back("error");
  }
}
