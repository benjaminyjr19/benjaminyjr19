import { redirect } from "next/navigation";

import type { Centre, User, Workspace } from "@/lib/types";
import type { CentreMemberRow, CentreRow, UserRow } from "@/lib/types/database";
import { isDemoMode } from "@/lib/env";
import { demoWorkspace } from "@/lib/demo/store";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Resolve the signed-in teacher and their centre for this request.
 * Returns null when unauthenticated or not yet a member of a centre.
 */
export async function getWorkspace(): Promise<Workspace | null> {
  if (isDemoMode()) return demoWorkspace();

  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data: userRow } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!userRow) return null;

  const { data: membership } = await supabase
    .from("centre_members")
    .select("*, centres(*)")
    .eq("user_id", authUser.id)
    .limit(1)
    .maybeSingle();
  if (!membership || !membership.centres) return null;

  const u = userRow as UserRow;
  const m = membership as CentreMemberRow & { centres: CentreRow };

  const user: User = { id: u.id, email: u.email, fullName: u.full_name };
  const centre: Centre = {
    id: m.centres.id,
    name: m.centres.name,
    timezone: m.centres.timezone,
    createdAt: m.centres.created_at,
  };

  return { user, centre, role: m.role === "lead" ? "lead" : "teacher" };
}

/** For dashboard pages: redirects to onboarding/login instead of returning null. */
export async function requireWorkspace(): Promise<Workspace> {
  const workspace = await getWorkspace();
  if (workspace) return workspace;

  if (isDemoMode()) {
    // Demo workspace always resolves; this is unreachable, but keeps types honest.
    redirect("/today");
  }

  const supabase = await createServerSupabase();
  const authed = supabase
    ? (await supabase.auth.getUser()).data.user !== null
    : false;
  redirect(authed ? "/onboarding" : "/login");
}

/** Create a centre for a newly signed-up teacher and join them to it. */
export async function createCentreForCurrentUser(centreName: string): Promise<void> {
  const supabase = await createServerSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: centre, error: centreError } = await supabase
    .from("centres")
    .insert({ name: centreName.trim(), timezone: "Asia/Singapore" })
    .select()
    .single();
  if (centreError) throw new Error(`Could not create centre: ${centreError.message}`);

  const { error: memberError } = await supabase
    .from("centre_members")
    .insert({ centre_id: centre.id, user_id: user.id, role: "lead" });
  if (memberError) throw new Error(`Could not join centre: ${memberError.message}`);
}

export async function updateCentreName(centreId: string, name: string): Promise<void> {
  if (isDemoMode()) {
    demoWorkspace().centre.name = name.trim();
    return;
  }
  const supabase = await createServerSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from("centres")
    .update({ name: name.trim() })
    .eq("id", centreId);
  if (error) throw new Error(`Could not update centre: ${error.message}`);
}

export async function updateUserName(userId: string, fullName: string): Promise<void> {
  if (isDemoMode()) {
    demoWorkspace().user.fullName = fullName.trim();
    return;
  }
  const supabase = await createServerSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from("users")
    .update({ full_name: fullName.trim() })
    .eq("id", userId);
  if (error) throw new Error(`Could not update profile: ${error.message}`);
}
