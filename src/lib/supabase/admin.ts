import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";

// Service-role client. Bypasses RLS. Server only: invites, login lookups, keep-alive.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Make sure an auth user exists for this email. The database trigger links it to the roster.
export async function ensureAuthUser(email: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error && error.code !== "email_exists" && !/already/i.test(error.message)) throw error;
  return admin;
}
