import { supabaseAdmin, json } from "@/lib/server";
import { verifyAdminRequest } from "@/lib/admin";

export const runtime = "nodejs";

// Admin: departments and who is in them
export async function GET(req) {
  if (!verifyAdminRequest(req)) return json({ error: "Unauthorized" }, 401);
  const db = supabaseAdmin();
  const [d, p] = await Promise.all([
    db.from("departments").select("*").order("name"),
    db.from("profiles").select("id, full_name, username, notify_email, gmail_address, avatar_color, role, role_title, department_id").order("full_name"),
  ]);
  if (d.error) return json({ error: "Departments table missing — run supabase/migrations/006_departments.sql." }, 500);
  return json({ departments: d.data, members: p.data || [] });
}

export async function POST(req) {
  if (!verifyAdminRequest(req)) return json({ error: "Unauthorized" }, 401);
  const db = supabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const done = ({ error }) => (error ? json({ error: error.code === "23505" ? "A department with that name already exists" : error.message }, 400) : json({ ok: true }));

  switch (body.action) {
    case "create":
      if (!name) return json({ error: "Department name required" }, 400);
      return done(await db.from("departments").insert({ name }));
    case "rename":
      if (!name) return json({ error: "Department name required" }, 400);
      return done(await db.from("departments").update({ name }).eq("id", body.id));
    case "delete":
      // members of a deleted department become unassigned (FK on delete set null)
      return done(await db.from("departments").delete().eq("id", body.id));
    case "assign":
      return done(await db.from("profiles").update({ department_id: body.departmentId || null }).eq("id", body.userId));
    case "title":
      return done(await db.from("profiles").update({ role_title: String(body.title || "").trim().slice(0, 60) || null }).eq("id", body.userId));
    default:
      return json({ error: "Unknown action" }, 400);
  }
}
