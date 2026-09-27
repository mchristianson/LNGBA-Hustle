import Papa from "papaparse";
import type { ImportRow } from "../actions";

// Headers are matched loosely so the association's existing spreadsheet works as-is.
// Expected (any order, case and spacing ignored):
//   Team, Jersey, Player First Name, Player Last Name (or Player Name),
//   Parent 1 Name, Parent 1 Email, Parent 2 Name, Parent 2 Email, ...
//   Coach Name, Coach Email (optional)
const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

export const TEMPLATE_HEADERS = [
  "Team", "Jersey", "Player First Name", "Player Last Name",
  "Parent 1 Name", "Parent 1 Email", "Parent 2 Name", "Parent 2 Email", "Coach Name", "Coach Email",
];

export function parseRoster(csv: string): { rows: ImportRow[]; warnings: string[] } {
  const parsed = Papa.parse<string[]>(csv.trim(), { skipEmptyLines: true });
  const [header, ...data] = parsed.data;
  const warnings: string[] = [];
  if (!header) return { rows: [], warnings: ["The file is empty."] };
  const h = header.map(norm);
  const find = (...names: string[]) => h.findIndex((x) => names.includes(x));

  const team = find("team", "teamname", "travelteam");
  const jersey = find("jersey", "jerseynumber", "jerseyno", "number", "no", "");
  const first = find("playerfirstname", "firstname", "first", "athletefirstname");
  const last = find("playerlastname", "lastname", "last", "athletelastname");
  const full = find("player", "playername", "athlete", "athletename", "name");
  const coachName = h.findIndex((x) => x.startsWith("coach") && x.endsWith("name"));
  const coachEmail = h.findIndex((x) => x.startsWith("coach") && x.includes("email"));
  const parentEmails = h.map((x, i) => (x.includes("email") && !x.startsWith("coach") ? i : -1)).filter((i) => i >= 0);
  const parentNames = h
    .map((x, i) => (/(parent|guardian|mom|dad|mother|father)/.test(x) && x.includes("name") && !x.includes("email") ? i : -1))
    .filter((i) => i >= 0);

  if (team < 0) warnings.push('No "Team" column found.');
  if (first < 0 && full < 0) warnings.push('No player name column found ("Player First Name" or "Player Name").');
  if (parentEmails.length === 0) warnings.push("No parent email columns found.");

  const rows: ImportRow[] = [];
  data.forEach((cells, n) => {
    const cell = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
    let firstName = cell(first);
    let lastName = cell(last);
    if (!firstName && full >= 0) {
      const parts = cell(full).split(/\s+/);
      firstName = parts.shift() ?? "";
      lastName = parts.join(" ");
    }
    if (!cell(team) || !firstName) {
      if (cells.some((c) => c.trim())) warnings.push(`Row ${n + 2} skipped: missing team or player name.`);
      return;
    }
    const parents = parentEmails
      .map((ei, k) => ({ email: cell(ei).toLowerCase(), name: cell(parentNames[k] ?? -1) }))
      .filter((p) => p.email);
    for (const p of parents) {
      if (!/^\S+@\S+\.\S+$/.test(p.email)) warnings.push(`Row ${n + 2}: "${p.email}" does not look like an email.`);
    }
    rows.push({
      team: cell(team),
      jersey: cell(jersey).replace(/^#/, ""),
      first_name: firstName,
      last_name: lastName,
      parents: parents.filter((p) => /^\S+@\S+\.\S+$/.test(p.email)),
      coaches: cell(coachEmail) ? [{ name: cell(coachName), email: cell(coachEmail).toLowerCase() }] : [],
    });
  });
  return { rows, warnings };
}
