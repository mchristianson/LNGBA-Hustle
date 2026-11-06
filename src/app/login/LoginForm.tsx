"use client";

import { useActionState } from "react";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import { sendLoginLink, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, sending] = useActionState(sendLoginLink, { email: "" } as LoginState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Your email" hint="Use the email the association has on file for you.">
        <input
          id="email" name="email" type="email" autoComplete="email" inputMode="email"
          defaultValue={state.email} className={inputClass} placeholder="you@example.com" required
        />
      </Field>
      {state.message && <Notice kind="ok">{state.message}</Notice>}
      {state.error && <Notice kind="warn">{state.error}</Notice>}
      <Button disabled={sending}>{sending ? "Sending..." : "Email me a login link"}</Button>
    </form>
  );
}
