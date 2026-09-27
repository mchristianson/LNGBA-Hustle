"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/session";
import { localInputToIso } from "@/lib/time";

export type GameFormState = { error?: string; saved?: string };

export async function addGame(teamId: string, _: GameFormState, formData: FormData): Promise<GameFormState> {
  const me = await requireMe();
  const opponent = String(formData.get("opponent") ?? "").trim();
  const when = String(formData.get("starts_at") ?? "");
  if (!opponent || !when) return { error: "Opponent and start time are required." };
  const supabase = await createClient();
  const { error } = await supabase.from("games").insert({
    team_id: teamId,
    opponent,
    starts_at: localInputToIso(when),
    location: String(formData.get("location") ?? "").trim(),
    event_name: String(formData.get("event_name") ?? "").trim(),
    created_by: me.personId,
  });
  if (error) return { error: "Could not save the game. Only coaches and admins can add games." };
  if (formData.get("another")) return { saved: `Saved vs. ${opponent}. Add the next one.` };
  redirect(`/teams/${teamId}`);
}
