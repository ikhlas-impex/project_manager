import { supabaseAdmin, json } from "@/lib/server";
import { verifyAdminRequest } from "@/lib/admin";
import { getAllowedDomains, googleConfigured } from "@/lib/google";

export const runtime = "nodejs";

export async function GET(req) {
  if (!verifyAdminRequest(req)) {
    return json({ error: "Unauthorized. Admin password required." }, 401);
  }

  const admin = supabaseAdmin();

  // Fetch all auth users
  const { data: usersData, error: usersErr } = await admin.auth.admin.listUsers();
  if (usersErr) {
    return json({ error: usersErr.message }, 500);
  }

  // Fetch all profiles
  const { data: profiles, error: profErr } = await admin.from("profiles").select("*");
  if (profErr) {
    return json({ error: profErr.message }, 500);
  }

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  // Merge user records
  const allUsers = (usersData?.users || []).map((u) => {
    const prof = profileMap.get(u.id) || {};
    const meta = u.user_metadata || {};

    const role = prof.role || meta.role || "employee";
    const managerStatus = meta.manager_request_status || "none";
    const requestedAt = meta.manager_requested_at || null;

    return {
      id: u.id,
      email: u.email,
      username: prof.username || u.email?.split("@")[0],
      full_name: prof.full_name || meta.full_name || u.email?.split("@")[0],
      role,
      avatar_color: prof.avatar_color || "#8b5cf6",
      gmail_address: prof.gmail_address || null,
      created_at: prof.created_at || u.created_at,
      manager_request_status: managerStatus,
      manager_requested_at: requestedAt,
      role_selected: Boolean(meta.role_selected || role === "manager"),
    };
  });

  // Filter pending manager requests
  const pendingRequests = allUsers.filter(
    (u) => u.manager_request_status === "pending" && u.role !== "manager"
  );

  const totalManagers = allUsers.filter((u) => u.role === "manager").length;
  const totalEmployees = allUsers.filter((u) => u.role === "employee").length;

  return json({
    users: allUsers,
    pendingRequests,
    stats: {
      totalUsers: allUsers.length,
      totalManagers,
      totalEmployees,
      pendingCount: pendingRequests.length,
    },
    allowedDomains: getAllowedDomains(),
    googleConfigured: googleConfigured(),
  });
}
