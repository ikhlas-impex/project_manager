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

  // Keep or ensure employee role in public.profiles
  await admin.from("profiles").update({ role: "employee" }).eq("id", userId);

  // Update metadata to rejected
  const { data: userRecord } = await admin.auth.admin.getUserById(userId);
  const currentMeta = userRecord?.user?.user_metadata || {};

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...currentMeta,
      role: "employee",
      role_selected: true,
      manager_request_status: "rejected",
      manager_rejected_at: new Date().toISOString(),
      reject_reason: body.reason || "Declined by administrator",
    },
  });

  return json({
    success: true,
    message: "Manager request declined. User role maintained as Employee.",
  });
}
