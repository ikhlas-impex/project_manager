import { supabaseAdmin, json } from "@/lib/server";
import { verifyAdminRequest } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(req) {
  if (!verifyAdminRequest(req)) {
    return json({ error: "Unauthorized. Admin password required." }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const userId = body.userId;
  if (!userId) {
    return json({ error: "userId is required." }, 400);
  }

  const admin = supabaseAdmin();

  // Delete from Auth (cascades to related tables)
  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) {
    console.warn("Could not delete from auth.users (might already be deleted):", authErr.message);
  }

  // Also ensure profile record is removed
  await admin.from("profiles").delete().eq("id", userId);

  return json({
    success: true,
    message: "User successfully removed.",
  });
}
