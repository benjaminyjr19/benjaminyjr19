import type {
  WeeklyPlan,
  WeeklyPlanContent,
  WeeklyPlanVersion,
  WeeklyPlanWithContent,
} from "@/lib/types";
import type { WeeklyPlanRow, WeeklyPlanVersionRow } from "@/lib/types/database";
import { isDemoMode } from "@/lib/env";
import {
  demoGetPlan,
  demoInsertPlan,
  demoInsertPlanVersion,
  demoListPlans,
  demoListPlanVersions,
  demoUpdatePlan,
  demoUserName,
} from "@/lib/demo/store";
import { createServerSupabase } from "@/lib/supabase/server";
import { newId } from "@/lib/utils/ids";

function mapPlan(row: WeeklyPlanRow): WeeklyPlan {
  return {
    id: row.id,
    centreId: row.centre_id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    theme: row.theme,
    ageGroup: row.age_group,
    className: row.class_name,
    status: row.status as WeeklyPlan["status"],
    currentVersion: row.current_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVersion(row: WeeklyPlanVersionRow): WeeklyPlanVersion {
  return {
    id: row.id,
    weeklyPlanId: row.weekly_plan_id,
    versionNumber: row.version_number,
    content: row.content as WeeklyPlanContent,
    changeSummary: row.change_summary,
    createdBy: row.created_by,
    createdByName: null,
    createdByAtlas: row.created_by_atlas,
    createdAt: row.created_at,
  };
}

export async function listPlans(centreId: string): Promise<WeeklyPlan[]> {
  if (isDemoMode()) return demoListPlans();

  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("centre_id", centreId)
    .order("week_start", { ascending: false });
  if (error) throw new Error(`Failed to load plans: ${error.message}`);
  return (data as WeeklyPlanRow[]).map(mapPlan);
}

export async function getPlan(planId: string): Promise<WeeklyPlan | null> {
  if (isDemoMode()) return demoGetPlan(planId);

  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load plan: ${error.message}`);
  return data ? mapPlan(data as WeeklyPlanRow) : null;
}

export async function listPlanVersions(planId: string): Promise<WeeklyPlanVersion[]> {
  if (isDemoMode()) return demoListPlanVersions(planId);

  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("weekly_plan_versions")
    .select("*")
    .eq("weekly_plan_id", planId)
    .order("version_number", { ascending: false });
  if (error) throw new Error(`Failed to load plan versions: ${error.message}`);
  return (data as WeeklyPlanVersionRow[]).map(mapVersion);
}

export async function getPlanWithContent(
  planId: string,
): Promise<{ plan: WeeklyPlanWithContent; versions: WeeklyPlanVersion[] } | null> {
  const plan = await getPlan(planId);
  if (!plan) return null;
  const versions = await listPlanVersions(planId);
  const current =
    versions.find((v) => v.versionNumber === plan.currentVersion) ?? versions[0];
  if (!current) return null;
  return { plan: { ...plan, content: current.content }, versions };
}

export async function insertPlan(input: {
  centreId: string;
  weekStart: string;
  weekEnd: string;
  theme: string;
  ageGroup: string;
  className: string | null;
  status: WeeklyPlan["status"];
  createdBy: string | null;
}): Promise<WeeklyPlan> {
  const nowISO = new Date().toISOString();
  const plan: WeeklyPlan = {
    id: newId(),
    centreId: input.centreId,
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    theme: input.theme,
    ageGroup: input.ageGroup,
    className: input.className,
    status: input.status,
    currentVersion: 0,
    createdBy: input.createdBy,
    createdAt: nowISO,
    updatedAt: nowISO,
  };

  if (isDemoMode()) return demoInsertPlan(plan);

  const supabase = await createServerSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("weekly_plans").insert({
    id: plan.id,
    centre_id: plan.centreId,
    week_start: plan.weekStart,
    week_end: plan.weekEnd,
    theme: plan.theme,
    age_group: plan.ageGroup,
    class_name: plan.className,
    status: plan.status,
    current_version: 0,
    created_by: plan.createdBy,
  });
  if (error) throw new Error(`Failed to create plan: ${error.message}`);
  return plan;
}

export async function updatePlan(
  planId: string,
  patch: Partial<Pick<WeeklyPlan, "status" | "currentVersion" | "theme">>,
): Promise<void> {
  if (isDemoMode()) {
    demoUpdatePlan(planId, patch);
    return;
  }

  const supabase = await createServerSupabase();
  if (!supabase) return;
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.currentVersion !== undefined) row.current_version = patch.currentVersion;
  if (patch.theme !== undefined) row.theme = patch.theme;
  const { error } = await supabase.from("weekly_plans").update(row).eq("id", planId);
  if (error) throw new Error(`Failed to update plan: ${error.message}`);
}

export async function insertPlanVersion(input: {
  weeklyPlanId: string;
  versionNumber: number;
  content: WeeklyPlanContent;
  changeSummary: string | null;
  createdBy: string | null;
  createdByName?: string | null;
  createdByAtlas: boolean;
}): Promise<WeeklyPlanVersion> {
  const version: WeeklyPlanVersion = {
    id: newId(),
    weeklyPlanId: input.weeklyPlanId,
    versionNumber: input.versionNumber,
    content: input.content,
    changeSummary: input.changeSummary,
    createdBy: input.createdBy,
    createdByName:
      input.createdByName ?? (isDemoMode() ? demoUserName(input.createdBy) : null),
    createdByAtlas: input.createdByAtlas,
    createdAt: new Date().toISOString(),
  };

  if (isDemoMode()) return demoInsertPlanVersion(version);

  const supabase = await createServerSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("weekly_plan_versions").insert({
    id: version.id,
    weekly_plan_id: version.weeklyPlanId,
    version_number: version.versionNumber,
    content: version.content,
    change_summary: version.changeSummary,
    created_by: version.createdBy,
    created_by_atlas: version.createdByAtlas,
  });
  if (error) throw new Error(`Failed to save plan version: ${error.message}`);
  return version;
}
