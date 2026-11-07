import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { PointsLegend } from "@/components/PointsLegend";
import { createClient } from "@/lib/supabase/server";
import { formatGameDate } from "@/lib/time";

type Row = {
  game_id: string; team_id: string; team_name: string; opponent: string; starts_at: string;
  rank: number | null; player_label: string | null; jersey_number: string | null; points: number | null;
};

// Public: one team's past games, with the top 3 for each. Works signed out.
export default async function TeamBoardPage({ params }: PageProps<"/board/team/[teamId]">) {
  const { teamId } = await params;
  const supabase = await createClient();
  const [{ data: teams }, { data: games }] = await Promise.all([
    supabase.rpc("public_teams"),
    supabase.rpc("public_game_board"),
  ]);
  const team = ((teams ?? []) as { team_id: string; team_name: string }[]).find((t) => t.team_id === teamId);
  if (!team) notFound();

  const byGame = new Map<string, { opponent: string; starts: string; rows: Row[] }>();
  for (const r of ((games ?? []) as Row[]).filter((r) => r.team_id === teamId)) {
    if (!byGame.has(r.game_id)) byGame.set(r.game_id, { opponent: r.opponent, starts: r.starts_at, rows: [] });
    if (r.rank !== null) byGame.get(r.game_id)!.rows.push(r);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageTitle eyebrow="Hustle Board">{team.team_name}</PageTitle>
      <Link href="/" className="text-sm font-semibold text-red">← All teams</Link>
      <PointsLegend />
      {byGame.size === 0 && <p>No games have been played yet.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {[...byGame.entries()].map(([id, g]) => (
          <section key={id} className="rounded-xl border border-line bg-card p-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl font-bold uppercase">vs. {g.opponent}</h2>
              <div className="shrink-0 text-sm text-muted">{formatGameDate(g.starts)}</div>
            </div>
            {g.rows.length === 0 ? (
              <p className="text-muted">No hustle points recorded</p>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {g.rows.map((r) => (
                  <li key={`${r.rank}-${r.player_label}-${r.jersey_number}`} className="flex items-baseline justify-between gap-3">
                    <span>
                      <span className="mr-2 font-display text-xl font-extrabold text-red">{r.rank}</span>
                      {r.jersey_number && <span className="text-muted">#{r.jersey_number} </span>}
                      <span className="font-semibold">{r.player_label}</span>
                    </span>
                    <span className="tabular font-display text-xl font-bold">{r.points}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
