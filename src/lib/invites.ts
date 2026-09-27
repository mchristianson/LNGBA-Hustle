import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, sendEmail } from "@/lib/email";
import { hashToken, newToken } from "@/lib/tokens";
import { siteUrl } from "@/lib/env";

export type InviteContext = {
  inviteId: string;
  personId: string;
  name: string;
  email: string;
  players: { name: string; jersey: string; team: string }[];
  coachTeams: string[];
  expired: boolean;
  accepted: boolean;
};

// Invites last until the end of the active season (or 180 days).
async function inviteExpiry() {
  const admin = createAdminClient();
  const { data } = await admin.from("seasons").select("ends_on").eq("is_active", true).maybeSingle();
  const end = data?.ends_on ? new Date(`${data.ends_on}T23:59:59-06:00`) : new Date(Date.now() + 180 * 864e5);
  return end.toISOString();
}

// Creates a fresh invite link. Older unused links for this person stop working.
export async function createInviteLink(personId: string) {
  const admin = createAdminClient();
  const token = newToken();
  await admin.from("invites").delete().eq("person_id", personId).is("accepted_at", null);
  const { error } = await admin.from("invites").insert({
    person_id: personId,
    token_hash: hashToken(token),
    expires_at: await inviteExpiry(),
  });
  if (error) throw error;
  return `${siteUrl()}/join/${token}`;
}

export async function loadInvite(token: string): Promise<InviteContext | null> {
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("id, person_id, expires_at, accepted_at, people(name, email)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!invite) return null;
  const person = invite.people as unknown as { name: string; email: string };
  const [{ data: kids }, { data: staff }] = await Promise.all([
    admin.from("guardians").select("players(first_name, last_name, jersey_number, teams(name))").eq("person_id", invite.person_id),
    admin.from("team_staff").select("teams(name)").eq("person_id", invite.person_id),
  ]);
  type Kid = { players: { first_name: string; last_name: string; jersey_number: string; teams: { name: string } } };
  return {
    inviteId: invite.id,
    personId: invite.person_id,
    name: person.name,
    email: person.email,
    players: ((kids ?? []) as unknown as Kid[]).map((k) => ({
      name: `${k.players.first_name} ${k.players.last_name}`.trim(),
      jersey: k.players.jersey_number,
      team: k.players.teams.name,
    })),
    coachTeams: ((staff ?? []) as unknown as { teams: { name: string } }[]).map((s) => s.teams.name),
    expired: new Date(invite.expires_at) < new Date(),
    accepted: !!invite.accepted_at,
  };
}

export async function emailInvite(personId: string) {
  const admin = createAdminClient();
  const { data: person } = await admin.from("people").select("email, name").eq("id", personId).single();
  if (!person) return { sent: false, error: "Person not found" };
  const url = await createInviteLink(personId);
  const token = url.split("/").pop()!;
  const ctx = (await loadInvite(token))!;
  const who = ctx.players.length
    ? ctx.players.map((p) => `${p.name}${p.jersey ? ` #${p.jersey}` : ""} (${p.team})`).join(", ")
    : ctx.coachTeams.length ? `coaching ${ctx.coachTeams.join(", ")}` : "your team";
  const subject = "Your LNGBA Hustle Tracker link";
  const text = `Hi ${person.name || "there"},\n\nTap this link to start tracking hustle points for ${who}:\n${url}\n\nNo password needed. Keep this email. The link works all season.\n\nLakeville North Girls Basketball Association`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#17171a">
<p>Hi ${escapeHtml(person.name || "there")},</p>
<p>Tap the button to start tracking hustle points for <b>${escapeHtml(who)}</b>.</p>
<p><a href="${url}" style="display:inline-block;background:#d7191f;color:#fff;padding:14px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Open Hustle Tracker</a></p>
<p style="color:#5d5a5c;font-size:14px">No password needed. Keep this email. The link works all season.<br>Lakeville North Girls Basketball Association</p></div>`;
  const result = await sendEmail(person.email, subject, html, text);
  if (result.sent) {
    await admin.from("invites").update({ sent_at: new Date().toISOString() }).eq("token_hash", hashToken(token));
  }
  return { ...result, url };
}

export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}${"*".repeat(Math.max(2, user.length - 1))}@${domain}`;
}
