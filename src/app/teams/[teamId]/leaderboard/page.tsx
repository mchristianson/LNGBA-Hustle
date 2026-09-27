import { notFound } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getRole, getTeam } from "@/lib/data";
import { requireMe } from "@/lib/session";

type Row = {
  player_id: string; first_name: string; last_name: string; jersey_number: string;
  points: number; games: number; r: number; s: number; b: number; d: number; c: number; a: number; t: number;
};

export default async function LeaderboardPage({ params, searchParams }: PageProps<"/teams/[teamId]/leaderboard">) {
  const { teamId } = await params;
  const sort = (await searchParams).sort === "avg" ? "avg" : "total";
  const me = await requireMe();
  const team = await getTeam(teamId);
  if (!team) notFound();
  const supabase = await createClient();
  const [{ myPlayerIds }, { data }] = await Promise.all([
    getRole(teamId, me.personId),
    supabase.from("player_season_totals").select("*").eq("team_id", teamId),
  ]);
  const avg = (r: Row) => (r.games ? r.points / r.games : 0);
  const rows = ((data ?? []) as Row[]).sort((x, y) =>
    sort === "avg" ? avg(y) - avg(x) || y.points - x.points : y.points - x.points || avg(y) - avg(x),
  );

  return (
    <div className="flex flex-col gap-4">
      <PageTitle eyebrow={team.name}>Leaderboard</PageTitle>
      <div className="flex gap-2 text-sm font-semibold" role="tablist">
        <a href="?sort=total" role="tab" aria-selected={sort === "total"}
          className={`rounded-full px-4 py-2 ${sort === "total" ? "bg-ink text-white" : "border border-line bg-card"}`}>Total points</a>
        <a href="?sort=avg" role="tab" aria-selected={sort === "avg"}
          className={`rounded-full px-4 py-2 ${sort === "avg" ? "bg-ink text-white" : "border border-line bg-card"}`}>Points per game</a>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[560px] text-left text-[15px] tabular">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-line">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2 text-right">Pts</th>
              <th className="px-3 py-2 text-right">GP</th>
              <th className="px-3 py-2 text-right">Per game</th>
              {["R", "S", "B", "D", "C", "A", "T"].map((k) => <th key={k} className="px-2 py-2 text-right">{k}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.player_id} className={`border-b border-line last:border-0 ${myPlayerIds.includes(r.player_id) ? "bg-red-soft" : ""}`}>
                <td className="px-3 py-2 font-bold text-red">{i + 1}</td>
                <td className="px-3 py-2 font-semibold">
                  {r.jersey_number && <span className="text-muted">#{r.jersey_number} </span>}
                  {r.first_name} {r.last_name}
                </td>
                <td className="px-3 py-2 text-right font-bold">{r.points}</td>
                <td className="px-3 py-2 text-right">{r.games}</td>
                <td className="px-3 py-2 text-right">{avg(r).toFixed(1)}</td>
                {(["r", "s", "b", "d", "c", "a", "t"] as const).map((k) => (
                  <td key={k} className="px-2 py-2 text-right text-muted">{r[k]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">GP counts games where the player had at least one hustle play recorded. The coach picks the trophy winner using either column.</p>
    </div>
  );
}
