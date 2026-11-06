"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/session";

// Coaches and admins only. The database enforces this (games delete policy), so a
// parent calling this gets no rows deleted. Deleting a game also deletes its hustle events.
export async function deleteGame(teamId: string, gameId: string) {
  await requireMe();
  const supabase = await createClient();
  await supabase.from("games").delete().eq("id", gameId).eq("team_id", teamId);
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/board");
  revalidatePath("/admin");
}
