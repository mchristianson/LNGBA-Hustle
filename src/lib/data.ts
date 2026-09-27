import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Team = { id: string; name: string; season_id: string; default_scorer_id: string | null };
export type Player = { id: string; first_name: string; last_name: string; jersey_number: string };
export type Game = {
  id: string; team_id: string; opponent: string; starts_at: string; location: string; event_name: string;
  scorer_id: string | null;
};

export async function getActiveSeason() {
  const supabase = await createClient();
  const { data } = await supabase.from("seasons").select("id, name, starts_on, ends_on").eq("is_active", true).maybeSingle();
  return data;
}

export async function getMyTeams() {
  const supabase = await createClient();
  const season = await getActiveSeason();
  if (!season) return [];
  const { data } = await supabase.from("teams").select("id, name, season_id, default_scorer_id").eq("season_id", season.id).order("name");
  return (data ?? []) as Team[];
}

export async function getTeam(teamId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("teams").select("id, name, season_id, default_scorer_id").eq("id", teamId).maybeSingle();
  return data as Team | null;
}

export async function getRole(teamId: string, personId: string) {
  const supabase = await createClient();
  const [{ data: staff }, { data: kids }] = await Promise.all([
    supabase.from("team_staff").select("person_id").eq("team_id", teamId).eq("person_id", personId).maybeSingle(),
    supabase.from("guardians").select("player_id, players!inner(team_id)").eq("person_id", personId).eq("players.team_id", teamId),
  ]);
  return { isStaff: !!staff, myPlayerIds: (kids ?? []).map((k) => k.player_id as string) };
}

export function sortPlayers<T extends Player>(players: T[]) {
  return [...players].sort((a, b) => {
    const na = parseInt(a.jersey_number, 10), nb = parseInt(b.jersey_number, 10);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return a.first_name.localeCompare(b.first_name);
  });
}

export function playerLabel(p: Pick<Player, "first_name" | "last_name">) {
  return `${p.first_name} ${p.last_name.slice(0, 1)}${p.last_name ? "." : ""}`.trim();
}
