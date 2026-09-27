import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function PageTitle({ eyebrow, children, action }: { eyebrow?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        {eyebrow && <div className="text-xs font-bold uppercase tracking-[0.12em] text-red">{eyebrow}</div>}
        <h1 className="text-4xl font-extrabold">{children}</h1>
      </div>
      {action}
    </div>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-xl border border-line bg-card p-4 ${className}`} {...props} />;
}

const buttonBase =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 font-display text-lg font-bold uppercase tracking-wide disabled:opacity-50";

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" }) {
  const styles = {
    primary: "bg-red text-white hover:bg-red-dark",
    secondary: "border border-ink bg-transparent text-ink hover:bg-ink hover:text-white",
    ghost: "text-muted underline underline-offset-4 min-h-0 px-0 normal-case font-sans text-base font-semibold tracking-normal",
  }[variant];
  return <button className={`${buttonBase} ${styles} ${className}`} {...props} />;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" }) {
  const styles = variant === "primary" ? "bg-red text-white hover:bg-red-dark" : "border border-ink text-ink hover:bg-ink hover:text-white";
  return <Link className={`${buttonBase} ${styles} ${className}`} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 font-semibold">
      {label}
      {children}
      {hint && <span className="text-sm font-normal text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base font-normal text-ink placeholder:text-muted/60";

export function Notice({ kind = "info", children }: { kind?: "info" | "ok" | "warn"; children: ReactNode }) {
  const styles = { info: "border-line bg-card", ok: "border-ok/30 bg-ok/10 text-ok", warn: "border-warn/30 bg-warn/10 text-warn" }[kind];
  return <div role="status" className={`rounded-lg border px-4 py-3 text-[15px] ${styles}`}>{children}</div>;
}
