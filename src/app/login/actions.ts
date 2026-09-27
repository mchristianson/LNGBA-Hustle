"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ensureAuthUser } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/env";

export type LoginState = { step: "email" | "code"; email: string; message?: string; error?: string };

const SENT = "If this email is on a team roster, a login link and code are on the way. Check your inbox and spam folder.";

export async function sendLoginLink(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { step: "email", email, error: "Enter a full email address." };

  // Only roster emails get a link. The reply is the same either way.
  const admin = createAdminClient();
  const { data: person } = await admin.from("people").select("id").ilike("email", email).maybeSingle();
  if (person) {
    await ensureAuthUser(email);
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl()}/auth/confirm` },
    });
    if (error && error.status === 429) {
      return { step: "code", email, error: "A link was sent a moment ago. Wait a minute before asking for another." };
    }
    if (error) return { step: "email", email, error: "We could not send the email. Try again in a minute." };
  }
  return { step: "code", email, message: SENT };
}

export async function verifyCode(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (token.length < 6) return { step: "code", email, error: "Enter the code from the email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", email, error: "That code did not work. Check it, or ask for a new one." };
  redirect("/");
}
