import { requireUser, supabaseAdmin, json } from "@/lib/server";

export const runtime = "nodejs";

export async function POST(req) {
  const auth = await requireUser(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const requested = String(body.role || "").toLowerCase().trim();

  if (requested !== "employee" && requested !== "manager") {
    return json({ error: "Invalid role selected. Must be 'employee' or 'manager'." }, 400);
  }

  const admin = supabaseAdmin();
  const userId = auth.user.id;
  const currentMeta = auth.user.user_metadata || {};

  // Department + role name chosen on the same screen
  const { count: deptCount } = await admin.from("departments").select("id", { count: "exact", head: true });
  if (deptCount) {
    const { data: dept } = await admin.from("departments").select("id").eq("id", body.department_id || "00000000-0000-0000-0000-000000000000").maybeSingle();
    if (!dept) return json({ error: "Please choose a valid department." }, 400);
    await admin
      .from("profiles")
      .update({ department_id: dept.id, role_title: String(body.role_title || "").trim().slice(0, 60) || null })
      .eq("id", userId);
  }

  if (requested === "employee") {
    // Freely selected employee
    await admin.from("profiles").update({ role: "employee" }).eq("id", userId);
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...currentMeta,
        role: "employee",
        role_selected: true,
        manager_request_status: "none",
        manager_requested_at: null,
      },
    });

    return json({
      success: true,
      role: "employee",
      status: "approved",
      message: "Employee role assigned successfully.",
    });
  }

  // Manager requested — requires admin approval!
  // User remains an employee until admin approves
  await admin.from("profiles").update({ role: "employee" }).eq("id", userId);
  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...currentMeta,
      role: "employee",
      role_selected: true,
      requested_role: "manager",
      manager_request_status: "pending",
      manager_requested_at: new Date().toISOString(),
    },
  });

  return json({
    success: true,
    role: "employee",
    status: "pending",
    message: "Manager request submitted. Pending administrator approval.",
  });
}
