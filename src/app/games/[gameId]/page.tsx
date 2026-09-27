import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTeam, sortPlayers, type Game, type Player } from "@/lib/data";
import { requireMe } from "@/lib/session";
import { formatGameDate } from "@/lib/time";
import { ScoreScreen, type Action, type HustleEvent, type ScorerStatus } from "./ScoreScreen";

export default async function GamePage({ params }: PageProps<"/games/[gameId]">) {
  const { gameId } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games").select("id, team_id, opponent, starts_at, location, event_name, scorer_id").eq("id", gameId).maybeSingle();
  if (!game) notFound();
  const g = game as Game;
  const [team, { data: players }, { data: actions }, { data: events }, { data: status }] = await Promise.all([
    getTeam(g.team_id),
    supabase.from("players").select("id, first_name, last_name, jersey_number").eq("team_id", g.team_id).eq("active", true),
    supabase.from("hustle_actions").select("code, label, points").order("sort_order"),
    supabase.from("hustle_events").select("id, player_id, action_code, points, recorded_by, voided_at, client_created_at").eq("game_id", gameId),
    supabase.rpc("game_scorer_status", { p_game: gameId }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href={`/teams/${g.team_id}`} className="text-xs font-bold uppercase tracking-[0.12em] text-red">
          ← {team?.name}
        </Link>
        <h1 className="text-4xl font-extrabold">vs. {g.opponent}</h1>
        <div className="text-[15px] text-muted">
          {[formatGameDate(g.starts_at), g.event_name, g.location].filter(Boolean).join(" · ")}
        </div>
      </div>
      <ScoreScreen
        gameId={gameId}
        me={me.personId}
        players={sortPlayers((players ?? []) as Player[])}
        actions={(actions ?? []) as Action[]}
        initialEvents={(events ?? []) as HustleEvent[]}
        initialStatus={((status ?? [])[0] ?? null) as ScorerStatus | null}
      />
    </div>
  );
}
