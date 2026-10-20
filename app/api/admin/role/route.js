import { supabaseAdmin, json } from "@/lib/server";
import { verifyAdminRequest } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(req) {
  if (!verifyAdminRequest(req)) {
    return json({ error: "Unauthorized. Admin password required." }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const userId = body.userId;
  const role = String(body.role || "").toLowerCase().trim();

  if (!userId || (role !== "manager" && role !== "employee")) {
    return json({ error: "userId and valid role ('manager' or 'employee') are required." }, 400);
  }

  const admin = supabaseAdmin();

  // Update profile
  const { error: profErr } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (profErr) {
    return json({ error: `Failed to update profile: ${profErr.message}` }, 500);
  }

  // Update user_metadata
  const { data: userRecord } = await admin.auth.admin.getUserById(userId);
  const currentMeta = userRecord?.user?.user_metadata || {};

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...currentMeta,
      role,
      role_selected: true,
      manager_request_status: role === "manager" ? "approved" : "none",
    },
  });

  return json({
    success: true,
    message: `User role updated to ${role}.`,
  });
}
