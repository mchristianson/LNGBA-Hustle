import { createClient } from "@/lib/supabase/server";

type Key = { code: string; label: string; points: number };

const fmtPts = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

// "How points work": each play's value from the live scoring key. Works signed out.
export async function PointsLegend() {
  const supabase = await createClient();
  const { data: key } = await supabase.rpc("public_scoring_key");
  const scoring = (key ?? []) as Key[];
  return (
    <details className="rounded-xl border border-line bg-card p-4" open>
      <summary className="cursor-pointer font-display text-xl font-bold uppercase">How points work</summary>
      <div className="mt-3 flex flex-col gap-3 text-[15px]">
        {scoring.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
            {scoring.map((k) => (
              <li key={k.code} className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
                <span>
                  <span className="mr-1.5 font-bold text-red">{k.code}</span>
                  {k.label}
                </span>
                <span className="tabular font-semibold">{fmtPts(k.points)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted">Points add up across every game this season. Plays that were undone don&apos;t count.</p>
      </div>
    </details>
  );
}
