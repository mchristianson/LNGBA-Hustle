import { TIME_ZONE } from "@/lib/env";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE, weekday: "short", month: "short", day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });

export function formatGameDate(iso: string) {
  return `${dateFmt.format(new Date(iso))} · ${timeFmt.format(new Date(iso))}`;
}

// "2026-11-07T09:00" typed on a phone in Minnesota -> UTC ISO string.
export function localInputToIso(value: string) {
  const [d, t = "00:00"] = value.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, day, hh, mm);
  const offset = zoneOffsetMs(new Date(guess));
  const first = guess - offset;
  // Recheck once in case the guess crossed a daylight saving change.
  return new Date(guess - zoneOffsetMs(new Date(first))).toISOString();
}

function zoneOffsetMs(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - date.getTime();
}
