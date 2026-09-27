import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, PageTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getRole, getTeam, playerLabel, type Game } from "@/lib/data";
import { requireMe } from "@/lib/session";
import { formatGameDate } from "@/lib/time";

export default async function TeamPage({ params }: PageProps<"/teams/[teamId]">) {
  const { teamId } = await params;
  const me = await requireMe();
  const team = await getTeam(teamId);
  if (!team) notFound();
  const supabase = await createClient();
  const [{ isStaff }, { data: games }, { data: players }] = await Promise.all([
    getRole(teamId, me.personId),
    supabase.from("games").select("id, team_id, opponent, starts_at, location, event_name, scorer_id").eq("team_id", teamId).order("starts_at"),
    supabase.from("players").select("id, first_name, last_name").eq("team_id", teamId),
  ]);
  const { upcoming, past } = splitGames((games ?? []) as Game[]);

  const { data: totals } = past.length
    ? await supabase.from("player_game_totals").select("game_id, player_id, points").in("game_id", past.map((g) => g.id))
    : { data: [] };
  const names = new Map((players ?? []).map((p) => [p.id, playerLabel(p)]));
  const top3 = (gameId: string) =>
    (totals ?? []).filter((t) => t.game_id === gameId).sort((a, b) => b.points - a.points).slice(0, 3);

  const canAdd = isStaff || me.isAdmin;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        eyebrow="Team"
        action={canAdd && <ButtonLink href={`/teams/${teamId}/games/new`}>Add game</ButtonLink>}
      >
        {team.name}
      </PageTitle>

      <div className="grid grid-cols-2 gap-3">
        <ButtonLink variant="secondary" href={`/teams/${teamId}/leaderboard`}>Leaderboard</ButtonLink>
        <ButtonLink variant="secondary" href="/board">Hustle Board</ButtonLink>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Upcoming</h2>
        {upcoming.length === 0 && <p className="text-muted">No games on the schedule yet.{canAdd && " Tap Add game."}</p>}
        {upcoming.map((g) => (
          <GameRow key={g.id} game={g} />
        ))}
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">Results</h2>
          {past.map((g) => (
            <GameRow key={g.id} game={g}>
              <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
                {top3(g.id).map((t, i) => (
                  <li key={t.player_id}>
                    <span className="font-bold text-red">{i + 1}.</span> {names.get(t.player_id)}{" "}
                    <span className="tabular font-semibold">{t.points}</span>
                  </li>
                ))}
                {top3(g.id).length === 0 && <li className="text-muted">No hustle points recorded</li>}
              </ol>
            </GameRow>
          ))}
        </section>
      )}
    </div>
  );
}

function GameRow({ game, children }: { game: Game; children?: React.ReactNode }) {
  return (
    <Link href={`/games/${game.id}`} className="block rounded-xl border border-line bg-card p-4 hover:border-red">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-display text-xl font-bold uppercase">vs. {game.opponent}</div>
        <div className="shrink-0 text-sm text-muted">{formatGameDate(game.starts_at)}</div>
      </div>
      {(game.event_name || game.location) && (
        <div className="text-sm text-muted">{[game.event_name, game.location].filter(Boolean).join(" · ")}</div>
      )}
      {children}
    </Link>
  );
}

// Games stay "upcoming" until 3 hours after the start time.
function splitGames(all: Game[]) {
  const cutoff = Date.now() - 3 * 3600e3;
  return {
    upcoming: all.filter((g) => new Date(g.starts_at).getTime() >= cutoff),
    past: all.filter((g) => new Date(g.starts_at).getTime() < cutoff).reverse(),
  };
}
