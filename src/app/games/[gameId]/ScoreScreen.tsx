"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Notice } from "@/components/ui";

export type Action = { code: string; label: string; points: number };
export type HustleEvent = {
  id: string; player_id: string; action_code: string; points: number;
  recorded_by: string; voided_at: string | null; client_created_at: string;
};
export type ScorerStatus = {
  scorer_id: string | null; scorer_name: string | null; is_me: boolean;
  can_claim: boolean; can_take_over: boolean; can_release: boolean;
};
type Player = { id: string; first_name: string; last_name: string; jersey_number: string };
type Op =
  | { type: "insert"; ev: { id: string; game_id: string; player_id: string; action_code: string; points: number; client_created_at: string } }
  | { type: "void"; id: string; voided_at: string };

const ICONS: Record<string, string> = { R: "🏀", S: "✋", B: "🛡️", D: "👐", C: "🛑", A: "🤝", T: "🔄" };
const fmtPts = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

const EVENT_COLUMNS = "id, player_id, action_code, points, recorded_by, voided_at, client_created_at";

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Feedback runs on the same frame as the tap and restarts cleanly if tapped again mid-animation.
function pulse(card: HTMLElement | undefined, kind: "add" | "undo") {
  if (!card) return;
  const add = kind === "add";
  card.animate(
    { backgroundColor: [add ? "var(--color-red-soft)" : "var(--color-paper)", "var(--color-card)"], borderColor: [add ? "var(--color-red)" : "var(--color-muted)", "var(--color-line)"] },
    { duration: 400, easing: "ease-out" },
  );
  const total = card.querySelector("[data-total]");
  if (total && !reducedMotion()) {
    total.animate({ transform: ["scale(1)", add ? "scale(1.15)" : "scale(0.88)", "scale(1)"] }, { duration: 220, easing: "ease-out" });
  }
}

// A write that failed because the phone is offline (no Postgres error code), as opposed to a refusal.
function isNetworkError(error: { code?: string; message?: string }) {
  return (typeof navigator !== "undefined" && !navigator.onLine) || !error.code || /fetch|network/i.test(error.message ?? "");
}

export function ScoreScreen(props: {
  gameId: string; me: string; players: Player[]; actions: Action[];
  initialEvents: HustleEvent[]; initialStatus: ScorerStatus | null;
}) {
  const { gameId, me, players, actions } = props;
  const supabase = useMemo(() => createClient(), []);
  const queueKey = `hustle-queue:${gameId}`;

  const [events, setEvents] = useState<Record<string, HustleEvent>>(() =>
    Object.fromEntries(props.initialEvents.map((e) => [e.id, e])),
  );
  const [status, setStatus] = useState<ScorerStatus | null>(props.initialStatus);
  const [queued, setQueued] = useState(0);
  const [online, setOnline] = useState(true);
  const [rejected, setRejected] = useState(0);
  const [busy, setBusy] = useState<"claim" | "takeover" | "release" | null>(null);
  const queue = useRef<Op[]>([]);
  const cards = useRef(new Map<string, HTMLDivElement>());
  const flushing = useRef(false);
  const wasScorer = useRef(props.initialStatus?.is_me ?? false);
  const [displacedBy, setDisplacedBy] = useState<string | null>(null);

  const persist = useCallback(() => {
    try { localStorage.setItem(queueKey, JSON.stringify(queue.current)); } catch {}
    setQueued(queue.current.length);
  }, [queueKey]);

  const refreshStatus = useCallback(async () => {
    const { data } = await supabase.rpc("game_scorer_status", { p_game: gameId });
    const next = (data?.[0] ?? null) as ScorerStatus | null;
    // Tell the phone that was scoring when someone else takes over.
    if (wasScorer.current && next?.scorer_id && !next.is_me) {
      setDisplacedBy(next.scorer_name ?? "Another parent");
      try { navigator.vibrate?.([200, 100, 200]); } catch {}
    }
    wasScorer.current = !!next?.is_me;
    if (data) setStatus(next);
  }, [supabase, gameId]);

  const refreshEvents = useCallback(async () => {
    const { data, error } = await supabase.from("hustle_events").select(EVENT_COLUMNS).eq("game_id", gameId);
    if (error || !data) return;
    setEvents((prev) => {
      const next: Record<string, HustleEvent> = Object.fromEntries((data as HustleEvent[]).map((e) => [e.id, e]));
      // Keep taps that are still waiting to upload.
      for (const op of queue.current) {
        if (op.type === "insert" && prev[op.ev.id]) next[op.ev.id] = prev[op.ev.id];
        if (op.type === "void" && next[op.id]) next[op.id] = { ...next[op.id], voided_at: op.voided_at };
      }
      return next;
    });
  }, [supabase, gameId]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      while (queue.current.length) {
        const op = queue.current[0];
        const { error } =
          op.type === "insert"
            ? await supabase.from("hustle_events").upsert({ ...op.ev, recorded_by: me }, { onConflict: "id", ignoreDuplicates: true })
            : await supabase.from("hustle_events").update({ voided_at: op.voided_at }).eq("id", op.id);
        if (error) {
          if (isNetworkError(error)) break; // try again when back online
          // Refused by the server (for example, someone else took over scoring).
          setRejected((n) => n + 1);
          if (op.type === "insert") {
            setEvents((prev) => {
              const next = { ...prev };
              delete next[op.ev.id];
              return next;
            });
          }
        }
        queue.current.shift();
        persist();
      }
    } finally {
      flushing.current = false;
      setQueued(queue.current.length);
    }
  }, [supabase, me, persist]);

  // Restore taps saved on this phone, then keep trying to upload them.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(queueKey) ?? "[]") as Op[];
      queue.current = saved;
      // Restoring from localStorage has to wait until after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEvents((prev) => {
        const next = { ...prev };
        for (const op of saved) {
          if (op.type === "insert") next[op.ev.id] = { ...op.ev, recorded_by: me, voided_at: null };
          if (op.type === "void" && next[op.id]) next[op.id] = { ...next[op.id], voided_at: op.voided_at };
        }
        return next;
      });
    } catch {}
    setQueued(queue.current.length);
    setOnline(navigator.onLine);
    flush();
    const goOnline = () => { setOnline(true); flush(); refreshEvents(); refreshStatus(); };
    const goOffline = () => setOnline(false);
    const onVisible = () => { if (document.visibilityState === "visible") { flush(); refreshEvents(); refreshStatus(); } };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => { flush(); refreshEvents(); }, 15000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [queueKey, me, flush, refreshEvents, refreshStatus]);

  // Live updates from the scorer's phone.
  useEffect(() => {
    const channel = supabase
      .channel(`game-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hustle_events", filter: `game_id=eq.${gameId}` }, (payload) => {
        const row = payload.new as HustleEvent;
        if (row?.id) setEvents((prev) => ({ ...prev, [row.id]: { ...prev[row.id], ...row } }));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => {
        refreshStatus();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, gameId, refreshStatus]);

  const isScorer = !!status?.is_me;

  // Roster arrives sorted by number. Name sort is remembered on this phone.
  const [sortBy, setSortBy] = useState<"number" | "name">("number");
  useEffect(() => {
    try {
      // Reading localStorage has to wait until after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem("hustle-sort") === "name") setSortBy("name");
    } catch {}
  }, []);
  function chooseSort(next: "number" | "name") {
    // A transition so the cards slide to their new spots instead of reshuffling.
    startTransition(() => setSortBy(next));
    try { localStorage.setItem("hustle-sort", next); } catch {}
  }
  const ordered = useMemo(
    () => sortBy === "name"
      ? [...players].sort((a, b) => a.first_name.localeCompare(b.first_name) || a.last_name.localeCompare(b.last_name))
      : players,
    [players, sortBy],
  );

  // Keep the screen awake while scoring.
  useEffect(() => {
    if (!isScorer || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = () => navigator.wakeLock.request("screen").then((l) => { lock = l; }).catch(() => {});
    request();
    const onVisible = () => { if (document.visibilityState === "visible") request(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); lock?.release().catch(() => {}); };
  }, [isScorer]);

  const pointsFor = useMemo(() => Object.fromEntries(actions.map((a) => [a.code, a.points])), [actions]);
  const live = Object.values(events).filter((e) => !e.voided_at);
  const totals = useMemo(() => {
    const t: Record<string, { points: number; counts: Record<string, number> }> = {};
    for (const p of players) t[p.id] = { points: 0, counts: {} };
    for (const e of live) {
      const row = t[e.player_id];
      if (!row) continue;
      row.points += e.points;
      row.counts[e.action_code] = (row.counts[e.action_code] ?? 0) + 1;
    }
    return t;
  }, [live, players]);
  const undoable = new Set(live.filter((e) => e.recorded_by === me).map((e) => e.player_id));

  function tap(playerId: string, code: string) {
    const ev = {
      id: crypto.randomUUID(), game_id: gameId, player_id: playerId, action_code: code,
      points: pointsFor[code] ?? 0, client_created_at: new Date().toISOString(),
    };
    setEvents((prev) => ({ ...prev, [ev.id]: { ...ev, recorded_by: me, voided_at: null } }));
    queue.current.push({ type: "insert", ev });
    persist();
    try { navigator.vibrate?.(15); } catch {}
    pulse(cards.current.get(playerId), "add");
    flush();
  }

  function undo(playerId: string) {
    const mine = live
      .filter((e) => e.player_id === playerId && e.recorded_by === me)
      .sort((a, b) => a.client_created_at.localeCompare(b.client_created_at));
    const last = mine.at(-1);
    if (!last) return;
    const pending = queue.current.findIndex((op) => op.type === "insert" && op.ev.id === last.id);
    if (pending >= 0 && !flushing.current) {
      queue.current.splice(pending, 1);
      setEvents((prev) => { const next = { ...prev }; delete next[last.id]; return next; });
    } else {
      const at = new Date().toISOString();
      queue.current.push({ type: "void", id: last.id, voided_at: at });
      setEvents((prev) => ({ ...prev, [last.id]: { ...prev[last.id], voided_at: at } }));
    }
    persist();
    try { navigator.vibrate?.([10, 40, 10]); } catch {}
    pulse(cards.current.get(playerId), "undo");
    flush();
  }

  async function claim(takeOver: boolean) {
    const name = status?.scorer_name ?? "the current scorer";
    if (takeOver && !confirm(`Take over scoring from ${name}?\n\nPoints already scored stay in the totals. ${name}'s new taps stop saving, and you'll score from here on.`)) return;
    setBusy(takeOver ? "takeover" : "claim");
    const { data } = await supabase.rpc("claim_scorer", { p_game: gameId, p_take_over: takeOver });
    await refreshStatus();
    setBusy(null);
    if (!data) alertOnce("Someone else started scoring first.");
  }

  async function release() {
    setBusy("release");
    await flush();
    await supabase.rpc("release_scorer", { p_game: gameId });
    await refreshStatus();
    setBusy(null);
  }

  const [message, setMessage] = useState<string | null>(null);
  function alertOnce(text: string) { setMessage(text); setTimeout(() => setMessage(null), 5000); }

  // Toast floats over the grid so the tap buttons never shift under a finger.
  const toastText = message ?? (rejected > 0
    ? `${rejected} tap${rejected === 1 ? "" : "s"} could not be saved because you are no longer the scorer for this game.`
    : null);
  // Keep the last text while the toast slides away.
  const [shownToast, setShownToast] = useState("");
  if (toastText && toastText !== shownToast) setShownToast(toastText);

  const syncLabel = !online
    ? queued ? `Offline · ${queued} saved on this phone` : "Offline"
    : queued ? `Saving ${queued}...` : "All saved";

  return (
    <div className="flex flex-col gap-4">
      <div className="material sticky top-[env(safe-area-inset-top)] z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="text-[15px]">
          {isScorer ? <b>You are scoring this game</b>
            : status?.scorer_id ? <><b>{status.scorer_name}</b> is scoring. Totals update live.</>
            : "Nobody is scoring yet."}
        </div>
        <div className={`flex items-center gap-1.5 text-sm font-semibold transition-colors duration-300 ${!online ? "text-warn" : queued ? "text-muted" : "text-ok"}`}>
          <span aria-hidden className="size-2 rounded-full bg-current" />
          {syncLabel}
        </div>
      </div>

      <div role="status" aria-live="polite" data-open={!!toastText} inert={!toastText}
        className="toast fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-20 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-ink px-4 py-3 text-[15px] text-white shadow-lg">
        <span className="flex-1">{shownToast}</span>
        <button type="button" className="press -my-2 px-2 py-3 font-semibold text-white/80 active:opacity-60"
          onClick={() => { setMessage(null); setRejected(0); }}>
          OK
        </button>
      </div>

      {displacedBy && (
        <div role="alert" className="flex items-center gap-3 rounded-xl bg-red px-4 py-3 text-[15px] text-white">
          <span className="flex-1"><b>{displacedBy} has taken over scoring.</b> Points already scored stay. Your new taps won&apos;t save.</span>
          <button type="button" className="press -my-2 px-2 py-3 font-semibold text-white/80 active:opacity-60" onClick={() => setDisplacedBy(null)}>
            Got it
          </button>
        </div>
      )}

      {!isScorer && status?.can_claim && (
        <Button className="text-xl" disabled={!!busy} onClick={() => claim(false)}>
          {busy === "claim" ? "Starting..." : <>I&apos;m scoring this game</>}
        </Button>
      )}
      {!isScorer && status?.can_take_over && (
        <Button variant="secondary" disabled={!!busy} onClick={() => claim(true)}>
          {busy === "takeover" ? "Taking over..." : "Take over scoring"}
        </Button>
      )}

      {isScorer && (
        <Notice>
          <b>Scoring:</b> {actions.map((a) => `${a.label} ${fmtPts(a.points)}`).join(" · ")}
        </Notice>
      )}

      {isScorer && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Sort by</span>
          {(["number", "name"] as const).map((k) => (
            <button key={k} type="button" onClick={() => chooseSort(k)} aria-pressed={sortBy === k}
              className={`press rounded-full border px-3 py-2 font-semibold ${sortBy === k ? "border-red bg-red text-white" : "border-line text-ink"}`}>
              {k === "number" ? "Number" : "First name"}
            </button>
          ))}
        </div>
      )}

      {isScorer ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {ordered.map((p) => (
            <ViewTransition key={p.id} name={`player-${p.id}`}>
              <div ref={(el) => { if (el) cards.current.set(p.id, el); return () => { cards.current.delete(p.id); }; }}
                className="flex flex-col gap-2.5 rounded-xl border border-line bg-card p-3">
                <div className="flex items-baseline justify-between">
                  <div className="font-display text-2xl font-bold">
                    {p.jersey_number && <span className="text-muted">#{p.jersey_number} </span>}
                    {p.first_name} {p.last_name.slice(0, 1)}
                  </div>
                  <div data-total className="origin-right font-display text-3xl font-extrabold tabular" aria-live="polite">{totals[p.id]?.points ?? 0}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {actions.map((a) => (
                    <button key={a.code} type="button" onClick={() => tap(p.id, a.code)}
                      aria-label={`${a.label} for ${p.first_name}`}
                      className={`press flex min-h-[56px] items-center justify-center gap-2 rounded-lg font-display text-lg font-bold text-white ${a.points < 0 ? "bg-neg" : "bg-red"}`}>
                      <span aria-hidden>{ICONS[a.code]}</span>{a.label} {fmtPts(a.points)}
                    </button>
                  ))}
                  <button type="button" onClick={() => undo(p.id)} disabled={!undoable.has(p.id)}
                    aria-label={`Undo last tap for ${p.first_name}`}
                    className="press min-h-[56px] rounded-lg border border-line font-display text-lg font-bold text-ink disabled:opacity-40">
                    Undo
                  </button>
                </div>
              </div>
            </ViewTransition>
          ))}
        </div>
      ) : (
        <ReadOnlyTotals players={players} totals={totals} actions={actions} />
      )}

      {status?.can_release && (
        <div className="pt-2 text-center">
          <Button variant="ghost" disabled={!!busy} onClick={release}>
            {busy === "release" ? "Stopping..."
              : isScorer ? "Stop scoring (let another parent take over)" : "Clear the current scorer"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ReadOnlyTotals({ players, totals, actions }: {
  players: Player[]; actions: Action[];
  totals: Record<string, { points: number; counts: Record<string, number> }>;
}) {
  const rows = [...players].sort((a, b) => (totals[b.id]?.points ?? 0) - (totals[a.id]?.points ?? 0));
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="w-full min-w-[480px] text-left text-[15px] tabular">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr className="border-b border-line">
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2 text-right">Pts</th>
            {actions.map((a) => <th key={a.code} className="px-2 py-2 text-right" title={a.label}>{a.label.slice(0, 3)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-line last:border-0">
              <td className="px-3 py-2 font-semibold">
                {p.jersey_number && <span className="text-muted">#{p.jersey_number} </span>}{p.first_name} {p.last_name.slice(0, 1)}
              </td>
              <td className="px-3 py-2 text-right font-bold">{totals[p.id]?.points ?? 0}</td>
              {actions.map((a) => <td key={a.code} className="px-2 py-2 text-right text-muted">{totals[p.id]?.counts[a.code] ?? 0}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
