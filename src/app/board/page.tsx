import { PageTitle } from "@/components/ui";
import { HustleBoard } from "@/components/HustleBoard";
import { createClient } from "@/lib/supabase/server";

export default async function BoardPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_teams");
  const season = (data ?? [])[0]?.season_name;
  return (
    <div className="flex flex-col gap-4">
      <PageTitle eyebrow={season ?? "Season"}>Hustle Board</PageTitle>
      <p className="text-muted">Top 3 hustle players on every team, updated after every game. Ties share a place, so everyone tied is listed.</p>
      <HustleBoard />
    </div>
  );
}
