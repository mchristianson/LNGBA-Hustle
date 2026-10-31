"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/session";
import { localInputToIso } from "@/lib/time";

type GameValues = { event_name: string; opponent: string; starts_at: string; location: string };
// values goes back to the form so React's post-submit reset keeps what was typed.
export type GameFormState = { error?: string; saved?: string; values?: GameValues };

export async function addGame(teamId: string, _: GameFormState, formData: FormData): Promise<GameFormState> {
  const me = await requireMe();
  const values: GameValues = {
    event_name: String(formData.get("event_name") ?? "").trim(),
    opponent: String(formData.get("opponent") ?? "").trim(),
    starts_at: String(formData.get("starts_at") ?? ""),
    location: String(formData.get("location") ?? "").trim(),
  };
  if (!values.opponent || !values.starts_at) return { error: "Opponent and start time are required.", values };
  const supabase = await createClient();
  const { error } = await supabase.from("games").insert({
    team_id: teamId,
    opponent: values.opponent,
    starts_at: localInputToIso(values.starts_at),
    location: values.location,
    event_name: values.event_name,
    created_by: me.personId,
  });
  if (error) {
    console.error("addGame insert failed", { teamId, personId: me.personId, code: error.code, message: error.message });
    return { error: "Could not save the game. Only this team's parents, coaches, and admins can add games.", values };
  }
  if (formData.get("another")) return { saved: `Saved vs. ${values.opponent}. Add the next one.`, values: { ...values, opponent: "" } };
  redirect(`/teams/${teamId}`);
}
