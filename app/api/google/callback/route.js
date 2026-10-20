import { supabaseAdmin } from "@/lib/server";
import { exchangeCode, getGoogleEmail, getGoogleUserInfo, isAllowedDomain, verifyState } from "@/lib/google";

export const runtime = "nodejs";

// Google redirects here after user signs in with Google OR connects Gmail from profile.
export async function GET(req) {
  const url = new URL(req.url);

  const stateParam = url.searchParams.get("state");
  const state = verifyState(stateParam);

  // If this was an employee Google login flow:
  if (state?.mode === "login") {
    if (url.searchParams.get("error")) {
      return Response.redirect(`${url.origin}/login?error=cancelled`, 302);
    }
    if (!state) {
      return Response.redirect(`${url.origin}/login?error=expired`, 302);
    }

    try {
      const code = url.searchParams.get("code");
      if (!code) return Response.redirect(`${url.origin}/login?error=missing_code`, 302);

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || url.origin).replace(/\/+$/, "");
      const tokens = await exchangeCode(appUrl, code);
      const userInfo = await getGoogleUserInfo(tokens.access_token);
      const email = userInfo.email.toLowerCase().trim();

      // Enforce Google Workspace domain check
      if (!isAllowedDomain(email)) {
        return Response.redirect(
          `${appUrl}/login?error=domain_not_allowed&email=${encodeURIComponent(email)}`,
          302
        );
      }

      const admin = supabaseAdmin();

      // Find or create user in Supabase Auth
      const { data: userList } = await admin.auth.admin.listUsers();
      let authUser = userList?.users?.find((u) => u.email?.toLowerCase() === email);

      if (!authUser) {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            full_name: userInfo.name,
            avatar_url: userInfo.picture,
            role_selected: false,
            manager_request_status: "none",
          },
        });
        if (createErr) throw createErr;
        authUser = created.user;
      }

      // Ensure profile exists in public.profiles
      const username = email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "");
      const { data: existingProfile } = await admin.from("profiles").select("*").eq("id", authUser.id).maybeSingle();

      if (!existingProfile) {
        await admin.from("profiles").insert({
          id: authUser.id,
          username,
          full_name: userInfo.name || username,
          role: "employee",
          notify_email: email,
          gmail_address: email,
        });
      } else {
        await admin
          .from("profiles")
          .update({
            gmail_address: email,
            ...(existingProfile.notify_email ? {} : { notify_email: email }),
            ...(existingProfile.full_name ? {} : { full_name: userInfo.name }),
          })
          .eq("id", authUser.id);
      }

      // If Google returned a refresh token, store it for Gmail notifications
      if (tokens.refresh_token) {
        await admin.from("google_accounts").upsert({
          user_id: authUser.id,
          email,
          refresh_token: tokens.refresh_token,
          updated_at: new Date().toISOString(),
        });
      }

      // Generate single-use Supabase session action link
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: `${appUrl}/auth/confirm`,
        },
      });

      if (linkErr || !linkData?.properties?.action_link) {
        throw linkErr || new Error("Failed to generate login authentication link");
      }

      // Pre-resolve token server-side to rewrite destination directly to the Vercel app
      try {
        const verifyRes = await fetch(linkData.properties.action_link, { redirect: "manual" });
        const targetLocation = verifyRes.headers.get("location");
        if (targetLocation && targetLocation.includes("access_token")) {
          const rewrittenUrl = targetLocation.replace(
            /^https?:\/\/[^/#?]+(?:\/auth\/confirm)?/,
            `${appUrl}/auth/confirm`
          );
          return Response.redirect(rewrittenUrl, 302);
        }
      } catch (preErr) {
        console.warn("Failed to pre-resolve action link server-side:", preErr);
      }

      return Response.redirect(linkData.properties.action_link, 302);
    } catch (e) {
      console.error("Google employee login failed:", e);
      return Response.redirect(`${url.origin}/login?error=auth_failed`, 302);
    }
  }

  // Otherwise, fallback to legacy "Connect Gmail" flow from /profile
  const back = (result) => Response.redirect(`${url.origin}/profile?gmail=${result}`, 302);

  if (url.searchParams.get("error")) return back("denied");
  if (!state || !state.uid) return back("expired");

  try {
    const tokens = await exchangeCode(url.origin, url.searchParams.get("code"));
    if (!tokens.scope?.includes("gmail.send")) return back("scope");
    const email = await getGoogleEmail(tokens.access_token);

    const admin = supabaseAdmin();
    const { data: existing } = await admin
      .from("google_accounts")
      .select("refresh_token")
      .eq("user_id", state.uid)
      .maybeSingle();
    const refreshToken = tokens.refresh_token || existing?.refresh_token;
    if (!refreshToken) return back("error");

    const { error } = await admin.from("google_accounts").upsert({
      user_id: state.uid,
      email,
      refresh_token: refreshToken,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

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
