import Link from "next/link";
import { Button, ButtonLink, Card, Field, PageTitle, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getActiveSeason } from "@/lib/data";
import { requireAdmin } from "@/lib/session";
import { addAdmin, createSeason } from "./actions";

export default async function AdminPage() {
  await requireAdmin();
  const season = await getActiveSeason();
  const supabase = await createClient();

  if (!season) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <PageTitle eyebrow="Admin">Start a season</PageTitle>
        <Card>
          <form action={createSeason} className="flex flex-col gap-4">
            <Field label="Season name"><input name="name" className={inputClass} defaultValue="2026-27" required /></Field>
            <Field label="Starts"><input name="starts_on" type="date" className={inputClass} defaultValue="2026-10-01" required /></Field>
            <Field label="Ends" hint="Invite links stop working after this date.">
              <input name="ends_on" type="date" className={inputClass} defaultValue="2027-03-31" required />
            </Field>
            <Button>Create season</Button>
          </form>
        </Card>
      </div>
    );
  }

  const [{ data: teams }, { data: players }, { data: guardians }, { data: people }, { data: admins }] = await Promise.all([
    supabase.from("teams").select("id, name").eq("season_id", season.id).order("name"),
    supabase.from("players").select("id, team_id").eq("active", true),
    supabase.from("guardians").select("person_id, player_id"),
    supabase.from("people").select("id, name, email, auth_user_id"),
    supabase.from("admins").select("person_id"),
  ]);
  const teamOfPlayer = new Map((players ?? []).map((p) => [p.id, p.team_id]));
  const joined = new Set((people ?? []).filter((p) => p.auth_user_id).map((p) => p.id));
  const stats = (teamId: string) => {
    const parentIds = new Set((guardians ?? []).filter((g) => teamOfPlayer.get(g.player_id) === teamId).map((g) => g.person_id));
    return {
      players: (players ?? []).filter((p) => p.team_id === teamId).length,
      parents: parentIds.size,
      joined: [...parentIds].filter((id) => joined.has(id)).length,
    };
  };
  const adminPeople = (people ?? []).filter((p) => (admins ?? []).some((a) => a.person_id === p.id));

  return (
    <div className="flex flex-col gap-6">
      <PageTitle eyebrow={`Admin · ${season.name}`} action={<ButtonLink href="/admin/import">Import roster</ButtonLink>}>
        Teams
      </PageTitle>

      {(teams ?? []).length === 0 && (
        <Card>No teams yet. Import the roster spreadsheet to create teams, players and parents in one step.</Card>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {(teams ?? []).map((t) => {
          const s = stats(t.id);
          return (
            <Link key={t.id} href={`/admin/teams/${t.id}`} className="rounded-xl border border-line bg-card p-4 hover:border-red">
              <div className="font-display text-2xl font-bold uppercase">{t.name}</div>
              <div className="text-sm text-muted tabular">
                {s.players} players · {s.joined}/{s.parents} parents logged in
              </div>
            </Link>
          );
        })}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Admins</h2>
        <ul className="text-[15px]">
          {adminPeople.map((p) => <li key={p.id}>{p.name || p.email} <span className="text-muted">· {p.email}</span></li>)}
        </ul>
        <Card>
          <form action={addAdmin} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Name"><input name="name" className={inputClass} /></Field>
            <Field label="Email"><input name="email" type="email" className={inputClass} required /></Field>
            <Button variant="secondary">Add admin</Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
