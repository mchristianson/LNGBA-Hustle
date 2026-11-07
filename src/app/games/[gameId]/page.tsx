import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canSeeDetail, getRole, getTeam, sortPlayers, type Game, type Player } from "@/lib/data";
import { requireMe } from "@/lib/session";
import { formatGameDate } from "@/lib/time";
import { ButtonLink } from "@/components/ui";
import { ScoreScreen, type Action, type HustleEvent, type ScorerStatus } from "./ScoreScreen";

export default async function GamePage({ params }: PageProps<"/games/[gameId]">) {
  const { gameId } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games").select("id, team_id, opponent, starts_at, location, event_name, scorer_id").eq("id", gameId).maybeSingle();
  if (!game) notFound();
  const g = game as Game;
  const canSee = await canSeeDetail(g.team_id, me.personId, me.isAdmin);
  const [{ isStaff }, team, { data: players }, { data: actions }, { data: events }, { data: status }] = await Promise.all([
    getRole(g.team_id, me.personId),
    getTeam(g.team_id),
    canSee ? supabase.from("players").select("id, first_name, last_name, jersey_number").eq("team_id", g.team_id).eq("active", true) : { data: [] },
    canSee ? supabase.from("hustle_actions").select("code, label, points").order("sort_order") : { data: [] },
    canSee ? supabase.from("hustle_events").select("id, player_id, action_code, points, recorded_by, voided_at, client_created_at").eq("game_id", gameId) : { data: [] },
    canSee ? supabase.rpc("game_scorer_status", { p_game: gameId }) : { data: [] },
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
        {(me.isAdmin || isStaff || g.scorer_id === me.personId) && (
          <div className="mt-2">
            <ButtonLink variant="secondary" href={`/games/${gameId}/edit`} className="min-h-10 text-base">Edit game</ButtonLink>
          </div>
        )}
      </div>
      {canSee ? (
        <ScoreScreen
          gameId={gameId}
          me={me.personId}
          players={sortPlayers((players ?? []) as Player[])}
          actions={(actions ?? []) as Action[]}
          initialEvents={(events ?? []) as HustleEvent[]}
          initialStatus={((status ?? [])[0] ?? null) as ScorerStatus | null}
        />
      ) : (
        <p className="text-muted">Hustle point details are for the team&apos;s scorers.</p>
      )}
    </div>
  );
}
