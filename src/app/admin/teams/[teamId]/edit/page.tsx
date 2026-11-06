import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, Field, Notice, PageTitle, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { sortPlayers, type Player } from "@/lib/data";
import { requireAdmin } from "@/lib/session";
import { addCoach, removeCoach } from "../../../actions";
import { addParent, addPlayer, removeGuardian, updatePerson, updatePlayer, updateTeam } from "./actions";

type Person = { id: string; name: string; email: string; auth_user_id: string | null };
type RosterPlayer = Player & { active: boolean };

export default async function RosterEditorPage({ params, searchParams }: PageProps<"/admin/teams/[teamId]/edit">) {
  const { teamId } = await params;
  const { error } = await searchParams;
  await requireAdmin();
  const supabase = await createClient();

  const { data: team } = await supabase.from("teams").select("id, name, is_public").eq("id", teamId).maybeSingle();
  if (!team) notFound();

  const [{ data: players }, { data: staff }] = await Promise.all([
    supabase.from("players").select("id, first_name, last_name, jersey_number, active").eq("team_id", teamId),
    supabase.from("team_staff").select("person_id").eq("team_id", teamId),
  ]);
  const playerIds = (players ?? []).map((p) => p.id);
  const { data: guardians } = playerIds.length
    ? await supabase.from("guardians").select("player_id, person_id").in("player_id", playerIds)
    : { data: [] };
  const personIds = [...new Set([...(guardians ?? []).map((g) => g.person_id), ...(staff ?? []).map((s) => s.person_id)])];
  const { data: people } = personIds.length
    ? await supabase.from("people").select("id, name, email, auth_user_id").in("id", personIds)
    : { data: [] };
  const byId = new Map(((people ?? []) as Person[]).map((p) => [p.id, p]));

  const parentsOf = (playerId: string) =>
    (guardians ?? []).filter((g) => g.player_id === playerId).map((g) => byId.get(g.person_id)).filter((p): p is Person => !!p);
  const coaches = (staff ?? []).map((s) => byId.get(s.person_id)).filter((p): p is Person => !!p);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle eyebrow={<Link href={`/admin/teams/${teamId}`}>← {team.name}</Link>}>Edit team</PageTitle>

      {error && <Notice kind="warn">{error}</Notice>}

      <Card>
        <form action={updateTeam.bind(null, teamId)} className="flex flex-col gap-4">
          <Field label="Team name">
            <input name="name" defaultValue={team.name} required className={inputClass} />
          </Field>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="is_public" defaultChecked={team.is_public} className="mt-1 size-5 accent-red" />
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">Visible to parents</span>
              <span className="text-sm font-normal text-muted">
                Off hides this team&apos;s roster, games and totals from parents, and takes it off the Hustle Board.
                Coaches and admins still see everything.
              </span>
            </span>
          </label>
          <Button variant="secondary">Save team</Button>
        </form>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Players</h2>
        {sortPlayers((players ?? []) as RosterPlayer[]).map((pl) => (
          <Card key={pl.id} className="flex flex-col gap-4">
            <form action={updatePlayer.bind(null, pl.id, teamId)} className="grid gap-3 sm:grid-cols-[6rem_1fr_1fr_auto] sm:items-end">
              <Field label="Jersey">
                <input name="jersey_number" defaultValue={pl.jersey_number} className={inputClass} />
              </Field>
              <Field label="First name">
                <input name="first_name" defaultValue={pl.first_name} required className={inputClass} />
              </Field>
              <Field label="Last name">
                <input name="last_name" defaultValue={pl.last_name} className={inputClass} />
              </Field>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" name="active" defaultChecked={pl.active} className="size-5 accent-red" />
                  Active
                </label>
                <Button variant="secondary">Save</Button>
              </div>
            </form>

            <div className="flex flex-col gap-3 border-t border-line pt-3">
              <div className="text-sm font-bold uppercase tracking-wide text-muted">Parents</div>
              {parentsOf(pl.id).length === 0 && <p className="text-muted">No parents linked yet.</p>}
              {parentsOf(pl.id).map((p) => (
                <div key={p.id} className="flex flex-col gap-2">
                  {p.auth_user_id ? (
                    <div className="text-[15px]">
                      <span className="font-semibold">{p.name || "No name"}</span>{" "}
                      <span className="text-muted">· {p.email} · logged in</span>
                    </div>
                  ) : (
                    <form action={updatePerson.bind(null, p.id, teamId)} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <Field label="Parent name">
                        <input name="name" defaultValue={p.name} className={inputClass} />
                      </Field>
                      <Field label="Email">
                        <input name="email" type="email" defaultValue={p.email} required className={inputClass} />
                      </Field>
                      <Button variant="secondary">Save</Button>
                    </form>
                  )}
                  <form action={removeGuardian.bind(null, pl.id, p.id, teamId)}>
                    <button className="text-sm text-muted underline">Remove {p.name || p.email} from {pl.first_name}</button>
                  </form>
                </div>
              ))}
              <form action={addParent.bind(null, pl.id, teamId)} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label="New parent name">
                  <input name="name" className={inputClass} />
                </Field>
                <Field label="New parent email">
                  <input name="email" type="email" required className={inputClass} />
                </Field>
                <Button variant="secondary">Add parent</Button>
              </form>
            </div>
          </Card>
        ))}

        <Card>
          <form action={addPlayer.bind(null, teamId)} className="grid gap-3 sm:grid-cols-[6rem_1fr_1fr_auto] sm:items-end">
            <Field label="Jersey">
              <input name="jersey_number" className={inputClass} />
            </Field>
            <Field label="First name">
              <input name="first_name" required className={inputClass} />
            </Field>
            <Field label="Last name">
              <input name="last_name" className={inputClass} />
            </Field>
            <Button variant="secondary">Add player</Button>
          </form>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Coaches</h2>
        {coaches.map((c) => (
          <Card key={c.id} className="flex flex-col gap-3">
            {c.auth_user_id ? (
              <div className="text-[15px]">
                <span className="font-semibold">{c.name || "No name"}</span>{" "}
                <span className="text-muted">· {c.email} · logged in</span>
              </div>
            ) : (
              <form action={updatePerson.bind(null, c.id, teamId)} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label="Coach name">
                  <input name="name" defaultValue={c.name} className={inputClass} />
                </Field>
                <Field label="Email">
                  <input name="email" type="email" defaultValue={c.email} required className={inputClass} />
                </Field>
                <Button variant="secondary">Save</Button>
              </form>
            )}
            <form action={removeCoach.bind(null, teamId, c.id)}>
              <button className="text-sm text-muted underline">Remove {c.name || c.email} as coach</button>
            </form>
          </Card>
        ))}
        <Card>
          <form action={addCoach.bind(null, teamId)} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Coach name">
              <input name="name" className={inputClass} />
            </Field>
            <Field label="Coach email">
              <input name="email" type="email" required className={inputClass} />
            </Field>
            <Button variant="secondary">Add coach</Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
