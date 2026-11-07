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
        {/* py-3 makes each target 44px tall; -my-2 keeps the header from growing. */}
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <Link href="/board" className="press -my-2 px-1.5 py-3 active:opacity-60">Hustle Board</Link>
          {signedIn ? (
            <>
              {isAdmin && <Link href="/admin" className="press -my-2 px-1.5 py-3 active:opacity-60">Admin</Link>}
              <form action="/auth/signout" method="post">
                <button className="press -my-2 px-1.5 py-3 text-white/70 hover:text-white active:opacity-60">Log out</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="press ml-1 rounded-lg bg-red px-3 py-1.5 text-white hover:bg-red-dark active:opacity-60">Log in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
