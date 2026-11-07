import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { canSeeDetail, getRole, getTeam, sortPlayers, type Player } from "@/lib/data";
import { requireMe } from "@/lib/session";
import { formatGameDate } from "@/lib/time";

type Row = {
  player_id: string; first_name: string; last_name: string; jersey_number: string;
  points: number; games: number; r: number; s: number; b: number; d: number; c: number; a: number; t: number;
};
type GameTotal = { player_id: string; points: number; r: number; s: number; b: number; d: number; c: number; a: number; t: number };
type PastGame = { id: string; opponent: string; starts_at: string };

const KEYS = ["r", "s", "b", "d", "c", "a", "t"] as const;
const LABELS = ["R", "S", "B", "D", "C", "A", "T"];

export default async function LeaderboardPage({ params, searchParams }: PageProps<"/teams/[teamId]/leaderboard">) {
  const { teamId } = await params;
  const query = await searchParams;
  const sort = query.sort === "avg" ? "avg" : "total";
  const gameId = typeof query.game === "string" ? query.game : null;
  const me = await requireMe();
  const team = await getTeam(teamId);
  if (!team) notFound();
  if (!(await canSeeDetail(teamId, me.personId, me.isAdmin))) redirect(`/teams/${teamId}`);
  const supabase = await createClient();
  const [{ myPlayerIds }, { data: games }] = await Promise.all([
    getRole(teamId, me.personId),
    supabase.from("games").select("id, opponent, starts_at").eq("team_id", teamId).lt("starts_at", new Date().toISOString()).order("starts_at", { ascending: false }),
  ]);
  const pastGames = (games ?? []) as PastGame[];
  const game = gameId ? pastGames.find((g) => g.id === gameId) : undefined;

  const tabs = (
    <div className="flex gap-2 text-sm font-semibold" role="tablist">
      <Link href="?sort=total" role="tab" aria-selected={!game && sort === "total"}
        className={`rounded-full px-4 py-2 ${!game && sort === "total" ? "bg-ink text-white" : "border border-line bg-card"}`}>Total points</Link>
      <Link href="?sort=avg" role="tab" aria-selected={!game && sort === "avg"}
        className={`rounded-full px-4 py-2 ${!game && sort === "avg" ? "bg-ink text-white" : "border border-line bg-card"}`}>Points per game</Link>
    </div>
  );

  const picker = pastGames.length > 0 && (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 text-sm font-semibold" aria-label="Choose a game">
      {pastGames.map((g) => (
        <Link key={g.id} href={`?game=${g.id}`} aria-current={game?.id === g.id ? "true" : undefined}
          className={`shrink-0 rounded-full px-4 py-2 ${game?.id === g.id ? "bg-ink text-white" : "border border-line bg-card"}`}>
          vs. {g.opponent} · {formatGameDate(g.starts_at)}
        </Link>
      ))}
    </div>
  );

  const table = game ? (
    <GameTable teamId={teamId} gameId={game.id} myPlayerIds={myPlayerIds} />
  ) : (
    <SeasonTable teamId={teamId} sort={sort} myPlayerIds={myPlayerIds} />
  );

  return (
    <div className="flex flex-col gap-4">
      <PageTitle eyebrow={team.name}>{game ? `vs. ${game.opponent}` : "Leaderboard"}</PageTitle>
      {game ? (
        <Link href={`/teams/${teamId}/leaderboard`} className="text-sm font-semibold text-red">← Season leaderboard</Link>
      ) : tabs}
      {picker}
      {table}
    </div>
  );
}

async function SeasonTable({ teamId, sort, myPlayerIds }: { teamId: string; sort: "total" | "avg"; myPlayerIds: string[] }) {
  const supabase = await createClient();
  const { data } = await supabase.from("player_season_totals").select("*").eq("team_id", teamId);
  const avg = (r: Row) => (r.games ? r.points / r.games : 0);
  const rows = ((data ?? []) as Row[]).sort((x, y) =>
    sort === "avg" ? avg(y) - avg(x) || y.points - x.points : y.points - x.points || avg(y) - avg(x),
  );
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[560px] text-left text-[15px] tabular">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-line">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2 text-right">Pts</th>
              <th className="px-3 py-2 text-right">GP</th>
              <th className="px-3 py-2 text-right">Per game</th>
              {LABELS.map((k) => <th key={k} className="px-2 py-2 text-right">{k}</th>)}
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
                {KEYS.map((k) => (
                  <td key={k} className="px-2 py-2 text-right text-muted">{r[k]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">GP counts games where the player had at least one hustle play recorded. The coach picks the trophy winner using either column.</p>
    </>
  );
}

async function GameTable({ teamId, gameId, myPlayerIds }: { teamId: string; gameId: string; myPlayerIds: string[] }) {
  const supabase = await createClient();
  const [{ data: players }, { data: totals }] = await Promise.all([
    supabase.from("players").select("id, first_name, last_name, jersey_number").eq("team_id", teamId).eq("active", true),
    supabase.from("player_game_totals").select("player_id, points, r, s, b, d, c, a, t").eq("game_id", gameId),
  ]);
  const byPlayer = new Map(((totals ?? []) as GameTotal[]).map((t) => [t.player_id, t]));
  const zero: GameTotal = { player_id: "", points: 0, r: 0, s: 0, b: 0, d: 0, c: 0, a: 0, t: 0 };
  const rows = sortPlayers((players ?? []) as Player[])
    .map((p) => ({ p, t: byPlayer.get(p.id) ?? zero }))
    .sort((x, y) => y.t.points - x.t.points);
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="w-full min-w-[420px] text-left text-[15px] tabular">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr className="border-b border-line">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2 text-right">Pts</th>
            {LABELS.map((k) => <th key={k} className="px-2 py-2 text-right">{k}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, t }, i) => (
            <tr key={p.id} className={`border-b border-line last:border-0 ${myPlayerIds.includes(p.id) ? "bg-red-soft" : ""}`}>
              <td className="px-3 py-2 font-bold text-red">{i + 1}</td>
              <td className="px-3 py-2 font-semibold">
                {p.jersey_number && <span className="text-muted">#{p.jersey_number} </span>}
                {p.first_name} {p.last_name}
              </td>
              <td className="px-3 py-2 text-right font-bold">{t.points}</td>
              {KEYS.map((k) => (
                <td key={k} className="px-2 py-2 text-right text-muted">{t[k]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
