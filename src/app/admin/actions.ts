"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/session";
import { createInviteLink, emailInvite } from "@/lib/invites";

export async function createSeason(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("seasons").update({ is_active: false }).eq("is_active", true);
  await supabase.from("seasons").insert({
    name: String(formData.get("name")),
    starts_on: String(formData.get("starts_on")),
    ends_on: String(formData.get("ends_on")),
    is_active: true,
  });
  revalidatePath("/admin");
}

export async function createTeam(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/admin?error=Team+name+is+required.");
  const supabase = await createClient();
  const { data: season } = await supabase.from("seasons").select("id").eq("is_active", true).maybeSingle();
  if (!season) redirect("/admin?error=Start+a+season+first.");
  const { data: team, error } = await supabase
    .from("teams").insert({ season_id: season.id, name }).select("id").single();
  if (error || !team) {
    redirect(`/admin?error=${encodeURIComponent(error?.code === "23505" ? "A team with that name already exists." : error?.message ?? "Could not create the team.")}`);
  }
  revalidatePath("/admin");
  redirect(`/admin/teams/${team.id}/edit`);
}

export type ImportRow = {
  team: string; jersey: string; first_name: string; last_name: string;
  parents: { name: string; email: string }[]; coaches: { name: string; email: string }[];
};

export async function importRoster(seasonId: string, rows: ImportRow[]) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_roster", { p_season: seasonId, p_rows: rows });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { result: data as { teams: number; players: number; people: number } };
}

export async function getInviteLink(personId: string) {
  await requireAdmin();
  return { url: await createInviteLink(personId) };
}

export async function sendInvite(personId: string, teamId: string) {
  await requireAdmin();
  const result = await emailInvite(personId);
  revalidatePath(`/admin/teams/${teamId}`);
  return result;
}

async function teamPeopleIds(teamId: string) {
  const admin = createAdminClient();
  const [{ data: kids }, { data: staff }] = await Promise.all([
    admin.from("guardians").select("person_id, players!inner(team_id)").eq("players.team_id", teamId),
    admin.from("team_staff").select("person_id").eq("team_id", teamId),
  ]);
  return [...new Set([...(kids ?? []), ...(staff ?? [])].map((r) => r.person_id as string))];
}

// Emails a fresh link to everyone on the team, including people who already logged in.
// Admin clicks this per team. Stops at the first failure.
export async function resendTeamLinks(teamId: string) {
  await requireAdmin();
  const ids = await teamPeopleIds(teamId);
  let count = 0;
  for (const id of ids) {
    const r = await emailInvite(id);
    if (!r.sent) {
      revalidatePath(`/admin/teams/${teamId}`);
      return { count, error: r.error };
    }
    count++;
  }
  revalidatePath(`/admin/teams/${teamId}`);
  return { count };
}

// Emails everyone on the team who has not logged in yet. Stops at the first failure
// (for example, the daily email limit).
export async function sendTeamInvites(teamId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const ids = await teamPeopleIds(teamId);
  const { data: people } = await admin.from("people").select("id, auth_user_id").in("id", ids);
  const { data: sent } = await admin.from("invites").select("person_id").in("person_id", ids).not("sent_at", "is", null);
  const alreadySent = new Set((sent ?? []).map((s) => s.person_id));
  let count = 0;
  for (const p of people ?? []) {
    if (p.auth_user_id || alreadySent.has(p.id)) continue;
    const r = await emailInvite(p.id);
    if (!r.sent) {
      revalidatePath(`/admin/teams/${teamId}`);
      return { count, error: r.error };
    }
    count++;
  }
  revalidatePath(`/admin/teams/${teamId}`);
  return { count };
}

export async function setDefaultScorer(teamId: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const personId = String(formData.get("person_id") ?? "") || null;
  await supabase.from("teams").update({ default_scorer_id: personId }).eq("id", teamId);
  revalidatePath(`/admin/teams/${teamId}`);
}

export async function addCoach(teamId: string, formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!email) return;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("people").select("id").ilike("email", email).maybeSingle();
  let personId = existing?.id as string | undefined;
  if (!personId) {
    const { data: created } = await supabase.from("people").insert({ email, name }).select("id").single();
    personId = created?.id;
  }
  if (personId) await supabase.from("team_staff").upsert({ team_id: teamId, person_id: personId });
  revalidatePath(`/admin/teams/${teamId}`);
}

export async function removeCoach(teamId: string, personId: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("team_staff").delete().eq("team_id", teamId).eq("person_id", personId);
  revalidatePath(`/admin/teams/${teamId}`);
}

export async function addAdmin(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!email) return;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("people").select("id").ilike("email", email).maybeSingle();
  let personId = existing?.id as string | undefined;
  if (!personId) {
    const { data: created } = await supabase.from("people").insert({ email, name }).select("id").single();
    personId = created?.id;
  }
  if (personId) await supabase.from("admins").upsert({ person_id: personId });
  revalidatePath("/admin");
}
