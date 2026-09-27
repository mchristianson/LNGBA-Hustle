import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;
  let isAdmin = false;
  if (signedIn) {
    const { data: admin } = await supabase.rpc("is_admin");
    isAdmin = !!admin;
  }
  return (
    <header className="bg-ink text-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-display text-2xl font-extrabold uppercase tracking-wide">
          LNGBA <span className="text-red">Hustle</span>
        </Link>
        {signedIn && (
          <nav className="flex items-center gap-4 text-sm font-semibold">
            <Link href="/board">Hustle Board</Link>
            {isAdmin && <Link href="/admin">Admin</Link>}
            <form action="/auth/signout" method="post">
              <button className="text-white/70 hover:text-white">Log out</button>
            </form>
          </nav>
        )}
      </div>
    </header>
  );
}
