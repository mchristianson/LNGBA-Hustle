"use client";

import { useActionState } from "react";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import { updateGame, type EditGameState } from "./actions";

type Initial = { event_name: string; opponent: string; starts_at: string; location: string };

export function EditGameForm({ gameId, teamId, initial }: { gameId: string; teamId: string; initial: Initial }) {
  const [state, action, pending] = useActionState(updateGame.bind(null, gameId, teamId), {} as EditGameState);
  const v = state.values ?? initial;
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Notice kind="warn">{state.error}</Notice>}
      <Field label="Tournament or event">
        <input id="event_name" name="event_name" defaultValue={v.event_name} className={inputClass} placeholder="Lakeville Fall Classic" />
      </Field>
      <Field label="Opponent">
        <input id="opponent" name="opponent" defaultValue={v.opponent} className={inputClass} placeholder="Prior Lake" required />
      </Field>
      <Field label="Date and time">
        <input id="starts_at" name="starts_at" defaultValue={v.starts_at} type="datetime-local" className={inputClass} required />
      </Field>
      <Field label="Location">
        <input id="location" name="location" defaultValue={v.location} className={inputClass} placeholder="Kenwood Trail MS, Court 2" />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save changes"}</Button>
    </form>
  );
}
