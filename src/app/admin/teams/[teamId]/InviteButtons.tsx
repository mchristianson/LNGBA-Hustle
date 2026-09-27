"use client";

import { useState, useTransition } from "react";
import { getInviteLink, sendInvite, sendTeamInvites } from "../../actions";

export function InviteButtons({ personId, teamId }: { personId: string; teamId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const copy = () =>
    start(async () => {
      const { url } = await getInviteLink(personId);
      setUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setMsg("Link copied. Paste it in a text or email.");
      } catch {
        setMsg("Copy the link below.");
      }
    });
  const email = () =>
    start(async () => {
      const r = await sendInvite(personId, teamId);
      setMsg(r.sent ? "Email sent." : r.error ?? "Email failed.");
      if (!r.sent && "url" in r && r.url) setUrl(r.url);
    });

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-3 text-sm font-semibold">
        <button type="button" className="text-red underline underline-offset-2" disabled={pending} onClick={copy}>Copy link</button>
        <button type="button" className="text-red underline underline-offset-2" disabled={pending} onClick={email}>Email invite</button>
      </div>
      {msg && <div className="text-xs text-muted">{msg}</div>}
      {url && <input readOnly value={url} onFocus={(e) => e.target.select()} className="w-full rounded border border-line px-2 py-1 text-xs" />}
    </div>
  );
}

export function TeamInviteButton({ teamId, pendingCount }: { teamId: string; pendingCount: number }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending || pendingCount === 0}
        onClick={() =>
          start(async () => {
            const r = await sendTeamInvites(teamId);
            setMsg(r.error ? `Sent ${r.count}. Stopped: ${r.error}` : `Sent ${r.count} invites.`);
          })
        }
        className="inline-flex min-h-12 items-center justify-center rounded-lg bg-red px-5 font-display text-lg font-bold uppercase tracking-wide text-white disabled:opacity-50"
      >
        {pending ? "Sending..." : `Email ${pendingCount} not yet invited`}
      </button>
      {msg && <div className="text-sm text-muted">{msg}</div>}
    </div>
  );
}
