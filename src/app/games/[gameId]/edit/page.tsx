import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, PageTitle } from "@/components/ui";
import { getRole, getTeam, type Game } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/session";
import { isoToLocalInput } from "@/lib/time";
import { EditGameForm } from "./EditGameForm";

export default async function EditGamePage({ params }: PageProps<"/games/[gameId]/edit">) {
  const { gameId } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games").select("id, team_id, opponent, starts_at, location, event_name, scorer_id").eq("id", gameId).maybeSingle();
  if (!game) notFound();
  const g = game as Game;
  const [team, { isStaff }] = await Promise.all([getTeam(g.team_id), getRole(g.team_id, me.personId)]);
  const canEdit = me.isAdmin || isStaff || g.scorer_id === me.personId;
  if (!canEdit) redirect(`/games/${gameId}`);
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <PageTitle eyebrow={team?.name}>Edit game</PageTitle>
      <Card>
        <EditGameForm
          gameId={gameId}
          teamId={g.team_id}
          initial={{
            event_name: g.event_name ?? "",
            opponent: g.opponent,
            starts_at: isoToLocalInput(g.starts_at),
            location: g.location ?? "",
          }}
        />
      </Card>
      <Link href={`/games/${gameId}`} className="text-center text-sm font-semibold text-muted underline underline-offset-4">
        Cancel
      </Link>
    </div>
  );
}
