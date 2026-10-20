import { requireUser, supabaseAdmin, json } from "@/lib/server";

export const runtime = "nodejs";

export async function GET(req) {
  const auth = await requireUser(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const admin = supabaseAdmin();
  const userId = auth.user.id;

  const { data: userRecord } = await admin.auth.admin.getUserById(userId);
  const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).single();

  const meta = userRecord?.user?.user_metadata || {};

  return json({
    role: profile?.role || meta.role || "employee",
    role_selected: Boolean(meta.role_selected || profile?.role === "manager"),
    manager_request_status: meta.manager_request_status || "none",
    manager_requested_at: meta.manager_requested_at || null,
  });
}
