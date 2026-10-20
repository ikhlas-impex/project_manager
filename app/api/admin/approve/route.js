import { supabaseAdmin, json } from "@/lib/server";
import { verifyAdminRequest } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(req) {
  if (!verifyAdminRequest(req)) {
    return json({ error: "Unauthorized. Admin password required." }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const userId = body.userId;
  if (!userId) return json({ error: "userId is required" }, 400);

  const admin = supabaseAdmin();

  // 1. Update public.profiles table
  const { error: profErr } = await admin.from("profiles").update({ role: "manager" }).eq("id", userId);
  if (profErr) {
    return json({ error: `Failed to update profile: ${profErr.message}` }, 500);
  }

  // 2. Update auth.users metadata
  const { data: userRecord } = await admin.auth.admin.getUserById(userId);
  const currentMeta = userRecord?.user?.user_metadata || {};

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...currentMeta,
      role: "manager",
      role_selected: true,
      manager_request_status: "approved",
      manager_approved_at: new Date().toISOString(),
    },
  });

  return json({
    success: true,
    message: "User successfully approved as Manager.",
  });
}
