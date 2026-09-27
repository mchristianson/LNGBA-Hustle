import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily Vercel Cron call so the free Supabase project never pauses between tournaments.
export async function GET(request: NextRequest) {
  if (process.env.CRON_SECRET && request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { count, error } = await createAdminClient().from("hustle_actions").select("*", { count: "exact", head: true });
  return NextResponse.json({ ok: !error, count });
}
