"use server";

import { redirect } from "next/navigation";

import { createCentreForCurrentUser } from "@/core/workspace/service";
import { isDemoMode } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

import type { ActionResult } from "./plans";

export async function signInAction(
  email: string,
  password: string,
): Promise<ActionResult> {
  if (isDemoMode()) redirect("/today");
  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  redirect("/today");
}

export async function signUpAction(
  email: string,
  password: string,
  fullName: string,
): Promise<ActionResult> {
  if (isDemoMode()) redirect("/today");
  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName.trim() || email.split("@")[0] } },
  });
  if (error) return { ok: false, error: error.message };
  // If email confirmation is enabled, there's no session yet.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: true,
      error: undefined,
      data: undefined,
    };
  }
  redirect("/onboarding");
}

export async function createCentreAction(centreName: string): Promise<ActionResult> {
  try {
    if (!centreName.trim()) return { ok: false, error: "Give your centre a name." };
    await createCentreForCurrentUser(centreName);
  } catch (error) {
    console.error("[atlas:action]", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Couldn't create the centre.",
    };
  }
  redirect("/today");
}

export async function signOutAction(): Promise<void> {
  if (!isDemoMode()) {
    const supabase = await createServerSupabase();
    await supabase?.auth.signOut();
  }
  redirect("/login");
}
