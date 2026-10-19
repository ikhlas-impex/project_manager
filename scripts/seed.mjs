// Creates the default accounts. Run: npm run seed   (reads .env.local)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

const DOMAIN = "teamflow.local"; // must match LOGIN_DOMAIN in lib/supabase.js
const users = [
  { username: "manager", password: "manager@123", role: "manager", full_name: "Manager" },
  { username: "user", password: "user@123", role: "employee", full_name: "Employee" },
];

for (const u of users) {
  const { error } = await admin.auth.admin.createUser({
    email: `${u.username}@${DOMAIN}`,
    password: u.password,
    email_confirm: true,
    user_metadata: { username: u.username, full_name: u.full_name, role: u.role },
  });
  if (error && !/already/i.test(error.message)) console.error(`x ${u.username}: ${error.message}`);
  else console.log(`ok ${u.username} / ${u.password}${error ? " (already existed)" : ""}`);
}
