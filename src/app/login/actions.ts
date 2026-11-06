"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { emailInvite } from "@/lib/invites";

export type LoginState = { email: string; message?: string; error?: string };

const SENT = "If this email is on a team roster, a login link is on the way. Check your inbox and spam folder.";

// Sends the same reusable link as the invite email. Its Yes button signs in on any
// device, and the link keeps working all season, so it can be opened again later.
export async function sendLoginLink(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { email, error: "Enter a full email address." };

  // Only roster emails get a link. The reply is the same either way.
  const { data: person } = await createAdminClient().from("people").select("id").ilike("email", email).maybeSingle();
  if (person) {
    const result = await emailInvite(person.id);
    if (!result.sent) return { email, error: "We could not send the email. Try again in a minute." };
  }
  return { email, message: SENT };
}
