import Link from "next/link";
import { Button, ButtonLink, Card, Field, Notice, PageTitle, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getActiveSeason } from "@/lib/data";
import { requireAdmin } from "@/lib/session";
import { addAdmin, createSeason, createTeam } from "./actions";

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const { error } = await searchParams;
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

  const [{ data: teams }, { data: players }, { data: guardians }, { data: people }, { data: admins }, { data: staff }, { data: games }] = await Promise.all([
    supabase.from("teams").select("id, name, is_public").eq("season_id", season.id).order("name"),
    supabase.from("players").select("id, team_id").eq("active", true),
    supabase.from("guardians").select("person_id, player_id"),
    supabase.from("people").select("id, name, email, auth_user_id"),
    supabase.from("admins").select("person_id"),
    supabase.from("team_staff").select("team_id, person_id"),
    supabase.from("games").select("team_id"),
  ]);
  const personById = new Map((people ?? []).map((p) => [p.id, p]));
  const coachesOf = (teamId: string) =>
    (staff ?? []).filter((s) => s.team_id === teamId).map((s) => personById.get(s.person_id)).filter((p) => !!p);
  const gamesOf = (teamId: string) => (games ?? []).filter((g) => g.team_id === teamId).length;
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

      {error && <Notice kind="warn">{error}</Notice>}

      {(teams ?? []).length === 0 && (
        <Card>No teams yet. Import the roster spreadsheet to create teams, players and parents in one step.</Card>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {(teams ?? []).map((t) => {
          const s = stats(t.id);
          const coaches = coachesOf(t.id);
          const gameCount = gamesOf(t.id);
          return (
            <div key={t.id} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
              <Link href={`/admin/teams/${t.id}`} className="press flex flex-col gap-1 hover:text-red">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-display text-2xl font-bold uppercase">{t.name}</div>
                  {!t.is_public && <span className="rounded bg-warn px-1.5 py-0.5 text-xs font-bold uppercase text-white">Hidden</span>}
                </div>
                <div className="text-sm text-muted tabular">
                  {s.players} players · {s.joined}/{s.parents} parents logged in
                </div>
              </Link>
              <div className="flex flex-col gap-1 border-t border-line pt-3 text-[15px]">
                <div className="text-xs font-bold uppercase tracking-wide text-muted">Coaches</div>
                {coaches.length === 0 && <div className="text-muted">No coaches yet</div>}
                {coaches.map((c) => (
                  <div key={c.id}>{c.name || c.email}</div>
                ))}
              </div>
              <Link href={`/teams/${t.id}`} className="font-semibold text-red underline underline-offset-4">
                {gameCount} {gameCount === 1 ? "game" : "games"} added · View games
              </Link>
            </div>
          );
        })}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Add a team</h2>
        <Card>
          <form action={createTeam} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Team name" hint="You can add players and parents on the next screen."><input name="name" className={inputClass} placeholder="14U Gold" required /></Field>
            <Button variant="secondary">Create team</Button>
          </form>
        </Card>
      </section>

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
