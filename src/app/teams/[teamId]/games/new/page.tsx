import { notFound, redirect } from "next/navigation";
import { Card, PageTitle } from "@/components/ui";
import { getRole, getTeam } from "@/lib/data";
import { requireMe } from "@/lib/session";
import { GameForm } from "./GameForm";

export default async function NewGamePage({ params }: PageProps<"/teams/[teamId]/games/new">) {
  const { teamId } = await params;
  const me = await requireMe();
  const team = await getTeam(teamId);
  if (!team) notFound();
  const { isStaff, myPlayerIds } = await getRole(teamId, me.personId);
  if (!isStaff && !me.isAdmin && myPlayerIds.length === 0) redirect(`/teams/${teamId}`);
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <PageTitle eyebrow={team.name}>Add game</PageTitle>
      <Card><GameForm teamId={teamId} /></Card>
    </div>
  );
}
