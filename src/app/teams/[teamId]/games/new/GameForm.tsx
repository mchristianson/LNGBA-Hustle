"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import { addGame, type GameFormState } from "./actions";

export function GameForm({ teamId }: { teamId: string }) {
  const [state, action, pending] = useActionState(addGame.bind(null, teamId), {} as GameFormState);
  const opponent = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state.saved && opponent.current) {
      opponent.current.value = "";
      opponent.current.focus();
    }
  }, [state]);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.saved && <Notice kind="ok">{state.saved}</Notice>}
      {state.error && <Notice kind="warn">{state.error}</Notice>}
      <Field label="Tournament or event" hint="Stays filled in when you add another game.">
        <input id="event_name" name="event_name" className={inputClass} placeholder="Lakeville Fall Classic" />
      </Field>
      <Field label="Opponent">
        <input ref={opponent} id="opponent" name="opponent" className={inputClass} placeholder="Prior Lake" required />
      </Field>
      <Field label="Date and time">
        <input id="starts_at" name="starts_at" type="datetime-local" className={inputClass} required />
      </Field>
      <Field label="Location">
        <input id="location" name="location" className={inputClass} placeholder="Kenwood Trail MS, Court 2" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Button type="submit" disabled={pending}>Save</Button>
        <Button type="submit" name="another" value="1" variant="secondary" disabled={pending}>Save + add another</Button>
      </div>
    </form>
  );
}
