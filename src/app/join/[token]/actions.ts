"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, ensureAuthUser } from "@/lib/supabase/admin";
import { loadInvite } from "@/lib/invites";

// "Yes, that's me." Signs the person in without a second email.
export async function acceptInvite(token: string) {
  const invite = await loadInvite(token);
  if (!invite || invite.expired) redirect("/login?error=link-expired");

  const admin = await ensureAuthUser(invite.email);
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: invite.email });
  if (error || !link.properties?.hashed_token) redirect("/login?error=link-expired");

  const supabase = await createClient();
  const { data: session, error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError || !session.user) redirect("/login?error=link-expired");

  await admin.from("people").update({ auth_user_id: session.user.id }).eq("id", invite.personId).is("auth_user_id", null);
  await admin.from("invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.inviteId).is("accepted_at", null);
  redirect("/");
}

export async function rejectInvite(token: string) {
  const invite = await loadInvite(token);
  if (invite) {
    await createAdminClient().from("invites").update({ flagged_at: new Date().toISOString() }).eq("id", invite.inviteId);
  }
  redirect(`/join/${token}?not-me=1`);
}
