"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, Card, Notice } from "@/components/ui";
import { importRoster, type ImportRow } from "../actions";
import { parseRoster, TEMPLATE_HEADERS } from "./parse";

export function ImportForm({ seasonId }: { seasonId: string }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setResult(null);
    setError(null);
    const parsed = parseRoster(await file.text());
    setRows(parsed.rows);
    setWarnings(parsed.warnings);
  }

  function onImport() {
    start(async () => {
      const res = await importRoster(seasonId, rows);
      if (res.error) setError(res.error);
      else if (res.result) {
        setResult(`Imported. New: ${res.result.teams} teams, ${res.result.players} players, ${res.result.people} parents and coaches.`);
        setRows([]);
      }
    });
  }

  const teams = [...new Set(rows.map((r) => r.team))];

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <input id="roster" type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])}
          className="text-base file:mr-3 file:min-h-12 file:rounded-lg file:border-0 file:bg-ink file:px-4 file:font-semibold file:text-white" />
        <p className="text-sm text-muted">Columns we look for: {TEMPLATE_HEADERS.join(", ")}. Add Parent 3, 4... if needed.</p>
      </Card>

      {result && <Notice kind="ok">{result} <Link href="/admin" className="underline">Back to teams</Link></Notice>}
      {error && <Notice kind="warn">{error}</Notice>}
      {warnings.length > 0 && (
        <Notice kind="warn">
          <ul className="list-disc pl-5">{warnings.slice(0, 20).map((w) => <li key={w}>{w}</li>)}</ul>
        </Notice>
      )}

      {rows.length > 0 && (
        <>
          <p className="font-semibold">
            {rows.length} players on {teams.length} teams: {teams.join(", ")}
          </p>
          <div className="max-h-[50vh] overflow-auto rounded-xl border border-line bg-card">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="sticky top-0 bg-card text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-3 py-2">Team</th><th className="px-3 py-2">#</th><th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2">Parents</th><th className="px-3 py-2">Coach</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0 align-top">
                    <td className="px-3 py-2">{r.team}</td>
                    <td className="px-3 py-2">{r.jersey}</td>
                    <td className="px-3 py-2 font-semibold">{r.first_name} {r.last_name}</td>
                    <td className="px-3 py-2">{r.parents.map((p) => p.email).join(", ") || <span className="text-warn">none</span>}</td>
                    <td className="px-3 py-2">{r.coaches.map((c) => c.email).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={onImport} disabled={pending}>{pending ? "Importing..." : `Import ${rows.length} players`}</Button>
        </>
      )}
    </div>
  );
}
