"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const EVENT_COLUMNS = "id, player_id, action_code, points, recorded_by, voided_at, client_created_at";

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
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queue = useRef<Op[]>([]);
  const flushing = useRef(false);

  const persist = useCallback(() => {
    try { localStorage.setItem(queueKey, JSON.stringify(queue.current)); } catch {}
    setQueued(queue.current.length);
  }, [queueKey]);

  const refreshStatus = useCallback(async () => {
    const { data } = await supabase.rpc("game_scorer_status", { p_game: gameId });
    if (data) setStatus((data[0] ?? null) as ScorerStatus | null);
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

  function tap(playerId: string, code: string) {
    const ev = {
      id: crypto.randomUUID(), game_id: gameId, player_id: playerId, action_code: code,
      points: pointsFor[code] ?? 0, client_created_at: new Date().toISOString(),
    };
    setEvents((prev) => ({ ...prev, [ev.id]: { ...ev, recorded_by: me, voided_at: null } }));
    queue.current.push({ type: "insert", ev });
    persist();
    try { navigator.vibrate?.(15); } catch {}
    setFlash(playerId);
    setTimeout(() => setFlash((f) => (f === playerId ? null : f)), 250);
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
    flush();
  }

  async function claim(takeOver: boolean) {
    setBusy(true);
    const { data } = await supabase.rpc("claim_scorer", { p_game: gameId, p_take_over: takeOver });
    await refreshStatus();
    setBusy(false);
    if (!data) alertOnce("Someone else started scoring first.");
  }

  async function release() {
    setBusy(true);
    await flush();
    await supabase.rpc("release_scorer", { p_game: gameId });
    await refreshStatus();
    setBusy(false);
  }

  const [message, setMessage] = useState<string | null>(null);
  function alertOnce(text: string) { setMessage(text); setTimeout(() => setMessage(null), 5000); }

  const syncLabel = !online
    ? queued ? `Offline · ${queued} saved on this phone` : "Offline"
    : queued ? `Saving ${queued}...` : "All saved";

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-[env(safe-area-inset-top)] z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/95 px-4 py-2 backdrop-blur">
        <div className="text-[15px]">
          {isScorer ? <b>You are scoring this game</b>
            : status?.scorer_id ? <><b>{status.scorer_name}</b> is scoring. Totals update live.</>
            : "Nobody is scoring yet."}
        </div>
        <div className={`text-sm font-semibold ${!online ? "text-warn" : queued ? "text-muted" : "text-ok"}`}>{syncLabel}</div>
      </div>

      {message && <Notice kind="warn">{message}</Notice>}
      {rejected > 0 && (
        <Notice kind="warn">
          {rejected} tap{rejected === 1 ? "" : "s"} could not be saved because you are no longer the scorer for this game.
        </Notice>
      )}

      {!isScorer && status?.can_claim && (
        <Button className="text-xl" disabled={busy} onClick={() => claim(false)}>I&apos;m scoring this game</Button>
      )}
      {!isScorer && status?.can_take_over && (
        <Button variant="secondary" disabled={busy} onClick={() => claim(true)}>Take over scoring</Button>
      )}

      {isScorer ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {players.map((p) => (
            <div key={p.id}
              className={`flex flex-col gap-2.5 rounded-xl border bg-card p-3 transition-colors ${flash === p.id ? "border-red bg-red-soft" : "border-line"}`}>
              <div className="flex items-baseline justify-between">
                <div className="font-display text-2xl font-bold">
                  {p.jersey_number && <span className="text-muted">#{p.jersey_number} </span>}
                  {p.first_name} {p.last_name.slice(0, 1)}
                </div>
                <div className="font-display text-3xl font-extrabold tabular" aria-live="polite">{totals[p.id]?.points ?? 0}</div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {actions.map((a) => (
                  <button key={a.code} type="button" onClick={() => tap(p.id, a.code)}
                    aria-label={`${a.label} for ${p.first_name}`}
                    className={`min-h-[52px] rounded-lg font-display text-lg font-bold text-white active:scale-95 ${a.points < 0 ? "bg-neg" : "bg-red"}`}>
                    {a.code} {a.points > 0 ? `+${a.points}` : `−${Math.abs(a.points)}`}
                  </button>
                ))}
                <button type="button" onClick={() => undo(p.id)} aria-label={`Undo last tap for ${p.first_name}`}
                  className="min-h-[52px] rounded-lg border border-line font-display text-lg font-bold text-ink active:scale-95">
                  Undo
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ReadOnlyTotals players={players} totals={totals} actions={actions} />
      )}

      {status?.can_release && (
        <div className="pt-2 text-center">
          <Button variant="ghost" disabled={busy} onClick={release}>
            {isScorer ? "Stop scoring (let another parent take over)" : "Clear the current scorer"}
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
            {actions.map((a) => <th key={a.code} className="px-2 py-2 text-right">{a.code}</th>)}
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
