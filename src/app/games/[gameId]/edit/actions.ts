"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/session";
import { localInputToIso } from "@/lib/time";

type GameValues = { event_name: string; opponent: string; starts_at: string; location: string };
export type EditGameState = { error?: string; values?: GameValues };

// The database checks who can edit (admin, team staff, or the current scorer).
// See supabase/migrations/20261110000000_edit_game_details.sql.
export async function updateGame(gameId: string, teamId: string, _: EditGameState, formData: FormData): Promise<EditGameState> {
  await requireMe();
  const values: GameValues = {
    event_name: String(formData.get("event_name") ?? "").trim(),
    opponent: String(formData.get("opponent") ?? "").trim(),
    starts_at: String(formData.get("starts_at") ?? ""),
    location: String(formData.get("location") ?? "").trim(),
  };
  if (!values.opponent || !values.starts_at) return { error: "Opponent and start time are required.", values };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_game_details", {
    p_game: gameId,
    p_event_name: values.event_name,
    p_opponent: values.opponent,
    p_starts_at: localInputToIso(values.starts_at),
    p_location: values.location,
  });
  if (error || !data) {
    console.error("updateGame failed", { gameId, code: error?.code, message: error?.message });
    return { error: "Could not save changes. Only this team's coaches, admins, and the game's scorer can edit a game.", values };
  }
  revalidatePath(`/games/${gameId}`);
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/board");
  redirect(`/games/${gameId}`);
}
