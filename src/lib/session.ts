import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Me = { personId: string; name: string; email: string; isAdmin: boolean };

// The signed-in roster person, or a redirect to /login.
export const requireMe = cache(async (): Promise<Me> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");
  let { data: person } = await supabase
    .from("people").select("id, name, email").eq("auth_user_id", claims.claims.sub).maybeSingle();
  if (!person) {
    // Roster entry added after this login was created: link it by email.
    await supabase.rpc("link_me");
    ({ data: person } = await supabase
      .from("people").select("id, name, email").eq("auth_user_id", claims.claims.sub).maybeSingle());
  }
  if (!person) redirect("/login?error=not-on-roster");
  const { data: admin } = await supabase.from("admins").select("person_id").eq("person_id", person.id).maybeSingle();
  return { personId: person.id, name: person.name, email: person.email, isAdmin: !!admin };
});

export async function requireAdmin() {
  const me = await requireMe();
  if (!me.isAdmin) redirect("/");
  return me;
}
