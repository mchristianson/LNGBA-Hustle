"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/session";

// Admin-only roster and team edits. Failures bounce back to the editor with ?error=.

function fail(teamId: string, message: string): never {
  redirect(`/admin/teams/${teamId}/edit?error=${encodeURIComponent(message)}`);
}

function done(teamId: string) {
  revalidatePath(`/admin/teams/${teamId}/edit`);
  revalidatePath(`/admin/teams/${teamId}`);
  revalidatePath("/admin");
  revalidatePath("/board");
}

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const emailOf = (fd: FormData) => text(fd, "email").toLowerCase();
const dupMessage = (err: { code?: string; message: string }) =>
  err.code === "23505" ? "That already exists on this team." : err.message;
// Escape LIKE wildcards so an email with _ in it matches only itself.
const exactEmail = (email: string) => email.replace(/[\\%_]/g, "\\$&");

export async function updateTeam(teamId: string, formData: FormData) {
  await requireAdmin();
  const name = text(formData, "name");
  if (!name) fail(teamId, "Team name is required.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .update({ name, is_public: formData.get("is_public") === "on" })
    .eq("id", teamId);
  if (error) fail(teamId, dupMessage(error));
  done(teamId);
}

export async function addPlayer(teamId: string, formData: FormData) {
  await requireAdmin();
  const first = text(formData, "first_name");
  if (!first) fail(teamId, "First name is required.");
  const supabase = await createClient();
  const { error } = await supabase.from("players").insert({
    team_id: teamId,
    first_name: first,
    last_name: text(formData, "last_name"),
    jersey_number: text(formData, "jersey_number"),
  });
  if (error) fail(teamId, dupMessage(error));
  done(teamId);
}

export async function updatePlayer(playerId: string, teamId: string, formData: FormData) {
  await requireAdmin();
  const first = text(formData, "first_name");
  if (!first) fail(teamId, "First name is required.");
  const supabase = await createClient();
  const { error } = await supabase.from("players").update({
    first_name: first,
    last_name: text(formData, "last_name"),
    jersey_number: text(formData, "jersey_number"),
    active: formData.get("active") === "on",
  }).eq("id", playerId);
  if (error) fail(teamId, dupMessage(error));
  done(teamId);
}

// Adds a parent to a player. Reuses the person row if the email is already on the roster.
export async function addParent(playerId: string, teamId: string, formData: FormData) {
  await requireAdmin();
  const email = emailOf(formData);
  if (!email) fail(teamId, "Parent email is required.");
  const name = text(formData, "name");
  const supabase = await createClient();

  const { data: existing } = await supabase.from("people").select("id").ilike("email", exactEmail(email)).maybeSingle();
  let personId = existing?.id as string | undefined;
  if (personId) {
    if (name) await supabase.from("people").update({ name }).eq("id", personId);
  } else {
    const { data: created, error } = await supabase.from("people").insert({ email, name }).select("id").single();
    if (error || !created) fail(teamId, error ? dupMessage(error) : "Could not add that parent.");
    personId = created.id;
  }
  const { error } = await supabase.from("guardians").upsert(
    { player_id: playerId, person_id: personId },
    { onConflict: "player_id,person_id", ignoreDuplicates: true },
  );
  if (error) fail(teamId, error.message);
  done(teamId);
}

// Edits a parent or coach. The email can change only before that person has logged in,
// because the login is tied to the email.
export async function updatePerson(personId: string, teamId: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: person } = await supabase.from("people").select("email, auth_user_id").eq("id", personId).maybeSingle();
  if (!person) fail(teamId, "That person is no longer on the roster.");

  const update: { name: string; email?: string } = { name: text(formData, "name") };
  const email = emailOf(formData);
  if (email && email !== person.email.toLowerCase()) {
    if (person.auth_user_id) fail(teamId, "This person has already logged in, so their email can't be changed here.");
    update.email = email;
  }
  const { error } = await supabase.from("people").update(update).eq("id", personId);
  if (error) fail(teamId, dupMessage(error));
  done(teamId);
}

// Removes the parent from one player. The person stays on the roster for other kids.
export async function removeGuardian(playerId: string, personId: string, teamId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("guardians").delete().eq("player_id", playerId).eq("person_id", personId);
  if (error) fail(teamId, error.message);
  done(teamId);
}
