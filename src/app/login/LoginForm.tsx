"use client";

import { useActionState } from "react";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import { sendLoginLink, verifyCode, type LoginState } from "./actions";

export function LoginForm() {
  const [emailState, sendAction, sending] = useActionState(sendLoginLink, { step: "email", email: "" } as LoginState);
  const [codeState, codeAction, verifying] = useActionState(verifyCode, { step: "code", email: "" } as LoginState);

  if (emailState.step === "code") {
    return (
      <div className="flex flex-col gap-4">
        {emailState.message && <Notice kind="ok">{emailState.message}</Notice>}
        {emailState.error && <Notice kind="warn">{emailState.error}</Notice>}
        <p>Tap the link in the email, or type the code here. The code works even if the email opens on another device.</p>
        <form action={codeAction} className="flex flex-col gap-4">
          <input type="hidden" name="email" value={emailState.email} />
          <Field label="Code from the email">
            <input
              id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={10}
              className={`${inputClass} tabular text-2xl tracking-[0.3em]`} placeholder="123456" required
            />
          </Field>
          {codeState.error && <Notice kind="warn">{codeState.error}</Notice>}
          <Button disabled={verifying}>{verifying ? "Checking..." : "Log in"}</Button>
        </form>
        <form action={sendAction}>
          <input type="hidden" name="email" value={emailState.email} />
          <Button variant="ghost" disabled={sending}>Send a new code</Button>
        </form>
      </div>
    );
  }

  return (
    <form action={sendAction} className="flex flex-col gap-4">
      <Field label="Your email" hint="Use the email the association has on file for you.">
        <input
          id="email" name="email" type="email" autoComplete="email" inputMode="email"
          defaultValue={emailState.email} className={inputClass} placeholder="you@example.com" required
        />
      </Field>
      {emailState.error && <Notice kind="warn">{emailState.error}</Notice>}
      <Button disabled={sending}>{sending ? "Sending..." : "Email me a login link"}</Button>
    </form>
  );
}
