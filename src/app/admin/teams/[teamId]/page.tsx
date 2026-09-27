import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, Field, PageTitle, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { sortPlayers, type Player } from "@/lib/data";
import { requireAdmin } from "@/lib/session";
import { addCoach, removeCoach, setDefaultScorer } from "../../actions";
import { InviteButtons, TeamInviteButton } from "./InviteButtons";

type Person = { id: string; name: string; email: string; auth_user_id: string | null };

export default async function AdminTeamPage({ params }: PageProps<"/admin/teams/[teamId]">) {
  const { teamId } = await params;
  await requireAdmin();
  const supabase = await createClient();
  const { data: team } = await supabase.from("teams").select("id, name, default_scorer_id").eq("id", teamId).maybeSingle();
  if (!team) notFound();

  const [{ data: players }, { data: staff }] = await Promise.all([
    supabase.from("players").select("id, first_name, last_name, jersey_number").eq("team_id", teamId).eq("active", true),
    supabase.from("team_staff").select("person_id, role").eq("team_id", teamId),
  ]);
  const playerIds = (players ?? []).map((p) => p.id);
  const { data: guardians } = playerIds.length
    ? await supabase.from("guardians").select("player_id, person_id").in("player_id", playerIds)
    : { data: [] };
  const personIds = [...new Set([...(guardians ?? []).map((g) => g.person_id), ...(staff ?? []).map((s) => s.person_id)])];
  const [{ data: people }, { data: invites }] = personIds.length
    ? await Promise.all([
        supabase.from("people").select("id, name, email, auth_user_id").in("id", personIds),
        supabase.from("invites").select("person_id, sent_at, accepted_at, flagged_at").in("person_id", personIds),
      ])
    : [{ data: [] }, { data: [] }];
  const byId = new Map(((people ?? []) as Person[]).map((p) => [p.id, p]));
  const inviteOf = new Map((invites ?? []).map((i) => [i.person_id, i]));

  const statusOf = (p: Person) => {
    const inv = inviteOf.get(p.id);
    if (inv?.flagged_at) return <span className="font-semibold text-warn">Said &quot;not me&quot;</span>;
    if (p.auth_user_id) return <span className="font-semibold text-ok">Logged in</span>;
    if (inv?.sent_at) return <span className="text-muted">Invited {new Date(inv.sent_at).toLocaleDateString()}</span>;
    return <span className="text-muted">Not invited</span>;
  };
  const parents = [...new Set((guardians ?? []).map((g) => g.person_id))].map((id) => byId.get(id)!).filter(Boolean);
  const notInvited = personIds.filter((id) => !byId.get(id)?.auth_user_id && !inviteOf.get(id)?.sent_at).length;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle eyebrow={<Link href="/admin">← Admin</Link>} action={<TeamInviteButton teamId={teamId} pendingCount={notInvited} />}>
        {team.name}
      </PageTitle>

      <Card>
        <form action={setDefaultScorer.bind(null, teamId)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Team scorer" hint="The parent who runs the app at games. They can take over scoring any game.">
            <select name="person_id" defaultValue={team.default_scorer_id ?? ""} className={inputClass}>
              <option value="">Not set</option>
              {parents.map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
            </select>
          </Field>
          <Button variant="secondary">Save</Button>
        </form>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Players and parents</h2>
        <div className="flex flex-col gap-2">
          {sortPlayers((players ?? []) as Player[]).map((pl) => (
            <Card key={pl.id} className="flex flex-col gap-2">
              <div className="font-display text-xl font-bold uppercase">
                {pl.jersey_number && <span className="text-muted">#{pl.jersey_number} </span>}{pl.first_name} {pl.last_name}
              </div>
              {(guardians ?? []).filter((g) => g.player_id === pl.id).map((g) => {
                const p = byId.get(g.person_id);
                if (!p) return null;
                return (
                  <div key={p.id} className="grid gap-1 border-t border-line pt-2 text-[15px] sm:grid-cols-[1fr_auto] sm:items-start">
                    <div>
                      <div className="font-semibold">{p.name || "No name"} {team.default_scorer_id === p.id && <span className="ml-1 rounded bg-red px-1.5 py-0.5 text-xs font-bold uppercase text-white">Scorer</span>}</div>
                      <div className="break-all text-muted">{p.email} · {statusOf(p)}</div>
                    </div>
                    <InviteButtons personId={p.id} teamId={teamId} />
                  </div>
                );
              })}
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Coaches</h2>
        {(staff ?? []).map((s) => {
          const p = byId.get(s.person_id);
          if (!p) return null;
          return (
            <Card key={p.id} className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <div>
                <div className="font-semibold">{p.name || "No name"}</div>
                <div className="break-all text-[15px] text-muted">{p.email} · {statusOf(p)}</div>
              </div>
              <div className="flex flex-col gap-1">
                <InviteButtons personId={p.id} teamId={teamId} />
                <form action={removeCoach.bind(null, teamId, p.id)}>
                  <button className="text-sm text-muted underline">Remove coach</button>
                </form>
              </div>
            </Card>
          );
        })}
        <Card>
          <form action={addCoach.bind(null, teamId)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Coach name"><input name="name" className={inputClass} /></Field>
            <Field label="Coach email"><input name="email" type="email" className={inputClass} required /></Field>
            <Button variant="secondary">Add coach</Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
