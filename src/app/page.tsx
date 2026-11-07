import Link from "next/link";
import { ButtonLink, Card, PageTitle } from "@/components/ui";
import { HustleBoard } from "@/components/HustleBoard";
import { getActiveSeason, getMyTeams } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/session";

// Home is the Hustle Board for everyone. Teams sit below it.
export default async function Home() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const signedIn = !!claims?.claims;

  let season: string | undefined;
  let teams: { id: string; name: string }[] = [];
  let isAdmin = false;
  let teamsKnown = false;

  if (signedIn) {
    const me = await requireMe();
    isAdmin = me.isAdmin;
    const [active, mine] = await Promise.all([getActiveSeason(), getMyTeams()]);
    season = active?.name;
    teams = mine.map((t) => ({ id: t.id, name: t.name }));
    teamsKnown = true;
  } else {
    const { data } = await supabase.rpc("public_teams");
    const rows = (data ?? []) as { team_id: string; team_name: string; season_name: string }[];
    season = rows[0]?.season_name;
    teams = rows.map((r) => ({ id: r.team_id, name: r.team_name }));
  }

  return (
    <div className="flex flex-col gap-8">
      <PageTitle eyebrow={season ?? "Season"}>Hustle Board</PageTitle>
      <p className="text-muted">Top 3 hustle players on every team, updated after every game. Ties share a place, so everyone tied is listed.</p>
      <HustleBoard />

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Teams</h2>
        {teams.length === 0 ? (
          <Card className="flex flex-col gap-3">
            {signedIn && teamsKnown ? (
              <>
                <p>You are not on a team roster yet.</p>
                {isAdmin && <ButtonLink href="/admin">Set up teams</ButtonLink>}
              </>
            ) : (
              <p>No teams yet.</p>
            )}
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((t) =>
              signedIn ? (
                <Link key={t.id} href={`/teams/${t.id}`} className="press rounded-xl border border-line bg-card p-4 hover:border-red active:bg-red-soft">
                  <div className="font-display text-2xl font-bold uppercase">{t.name}</div>
                  <div className="text-sm text-muted">Schedule and leaderboard</div>
                </Link>
              ) : (
                <Link key={t.id} href={`/board/team/${t.id}`} className="press rounded-xl border border-line bg-card p-4 hover:border-red active:bg-red-soft">
                  <div className="font-display text-2xl font-bold uppercase">{t.name}</div>
                  <div className="text-sm text-muted">Game results</div>
                </Link>
              ),
            )}
          </div>
        )}
        {!signedIn && (
          <Card className="flex flex-col gap-3">
            <p>Parents and coaches: log in to see schedules, results, and scoring.</p>
            <ButtonLink href="/login">Log in</ButtonLink>
          </Card>
        )}
      </section>
    </div>
  );
}
