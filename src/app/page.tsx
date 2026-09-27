import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink, Card, PageTitle } from "@/components/ui";
import { getActiveSeason, getMyTeams } from "@/lib/data";
import { requireMe } from "@/lib/session";

export default async function Home() {
  const me = await requireMe();
  const [season, teams] = await Promise.all([getActiveSeason(), getMyTeams()]);

  if (teams.length === 1 && !me.isAdmin) redirect(`/teams/${teams[0].id}`);

  return (
    <div className="flex flex-col gap-5">
      <PageTitle eyebrow={season?.name ?? "No active season"}>Hi{me.name ? `, ${me.name.split(" ")[0]}` : ""}</PageTitle>
      {teams.length === 0 ? (
        <Card className="flex flex-col gap-3">
          <p>You are not on a team roster yet.</p>
          {me.isAdmin && <ButtonLink href="/admin">Set up teams</ButtonLink>}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((t) => (
            <Link key={t.id} href={`/teams/${t.id}`} className="rounded-xl border border-line bg-card p-4 hover:border-red">
              <div className="font-display text-2xl font-bold uppercase">{t.name}</div>
              <div className="text-sm text-muted">Schedule and leaderboard</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
