"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser-side Supabase client. Only call when Supabase is configured. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
