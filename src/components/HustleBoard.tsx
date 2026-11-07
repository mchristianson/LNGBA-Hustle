import { createClient } from "@/lib/supabase/server";

type Row = { team_id: string; team_name: string; rank: number; player_label: string; jersey_number: string; points: number; games: number };

// Top 3 per team. Works signed out: the hustle_board function is public.
export async function HustleBoard() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("hustle_board");
  const teams = new Map<string, { name: string; rows: Row[] }>();
  for (const r of (data ?? []) as Row[]) {
    if (!teams.has(r.team_id)) teams.set(r.team_id, { name: r.team_name, rows: [] });
    teams.get(r.team_id)!.rows.push(r);
  }
  if (teams.size === 0) return <p>No teams yet.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[...teams.entries()].map(([id, t]) => (
        <section key={id} className="rounded-xl border border-line bg-card p-4">
          <h2 className="mb-2 text-2xl font-bold">{t.name}</h2>
          <ol className="flex flex-col gap-1.5">
            {t.rows.map((r) => (
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
        </section>
      ))}
    </div>
  );
}
