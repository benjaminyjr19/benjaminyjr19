"use server";

import { revalidatePath } from "next/cache";

import { requireWorkspace } from "@/core/workspace/service";
import {
  approvePlan,
  contributePlanToLibrary,
  getPlanWithContent,
  prepareWeek,
  regeneratePlanSection,
  restorePlanVersion,
  savePlanEdits,
} from "@/core/weekly-planning/service";
import type { PlanSection, WeeklyPlanContent, WeeklyPlanVersion } from "@/lib/types";
import { PLAN_SECTIONS } from "@/lib/types";

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

function failure<T>(error: unknown, fallback: string): ActionResult<T> {
  console.error("[atlas:action]", error);
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

export async function prepareWeekAction(input: {
  weekStart: string;
  weekEnd: string;
  theme: string;
  ageGroup: string;
  className: string | null;
  teacherNotes: string | null;
}): Promise<ActionResult<{ planId: string }>> {
  try {
    const workspace = await requireWorkspace();
    if (!input.theme.trim()) return { ok: false, error: "Give the week a theme." };
    const plan = await prepareWeek(workspace, {
      weekStart: input.weekStart,
      weekEnd: input.weekEnd,
      theme: input.theme.trim(),
      ageGroup: input.ageGroup.trim() || "K1",
      className: input.className?.trim() || null,
      teacherNotes: input.teacherNotes,
    });
    revalidatePath("/today");
    revalidatePath("/review");
    revalidatePath("/week");
    return { ok: true, data: { planId: plan.id } };
  } catch (error) {
    return failure(error, "Atlas couldn't prepare the week. Please try again.");
  }
}

export async function savePlanAction(
  planId: string,
  content: WeeklyPlanContent,
): Promise<ActionResult<{ version: number }>> {
  try {
    const workspace = await requireWorkspace();
    const version = await savePlanEdits(workspace, planId, content);
    revalidatePath(`/week/${planId}`);
    revalidatePath("/today");
    return { ok: true, data: { version: version.versionNumber } };
  } catch (error) {
    return failure(error, "Your edits couldn't be saved. Please try again.");
  }
}

export async function approvePlanAction(planId: string): Promise<ActionResult> {
  try {
    const workspace = await requireWorkspace();
    await approvePlan(workspace, planId);
    revalidatePath(`/week/${planId}`);
    revalidatePath("/today");
    revalidatePath("/review");
    return { ok: true };
  } catch (error) {
    return failure(error, "The plan couldn't be approved. Please try again.");
  }
}

export async function regenerateSectionAction(
  planId: string,
  section: PlanSection,
  instruction: string | null,
): Promise<ActionResult<{ content: WeeklyPlanContent; version: number }>> {
  try {
    if (!PLAN_SECTIONS.includes(section)) {
      return { ok: false, error: "Unknown section." };
    }
    const workspace = await requireWorkspace();
    const version = await regeneratePlanSection(workspace, planId, section, instruction);
    revalidatePath(`/week/${planId}`);
    return {
      ok: true,
      data: { content: version.content, version: version.versionNumber },
    };
  } catch (error) {
    return failure(error, "Atlas couldn't rework that section. Your plan is unchanged.");
  }
}

export async function restorePlanVersionAction(
  planId: string,
  versionNumber: number,
): Promise<ActionResult<{ content: WeeklyPlanContent }>> {
  try {
    const workspace = await requireWorkspace();
    const loaded = await getPlanWithContent(planId);
    if (!loaded) return { ok: false, error: "Plan not found." };
    const target = loaded.versions.find(
      (v: WeeklyPlanVersion) => v.versionNumber === versionNumber,
    );
    if (!target) return { ok: false, error: "Version not found." };
    await restorePlanVersion(workspace, planId, target);
    revalidatePath(`/week/${planId}`);
    return { ok: true, data: { content: target.content } };
  } catch (error) {
    return failure(error, "The version couldn't be restored.");
  }
}

export async function contributePlanAction(
  planId: string,
): Promise<ActionResult<{ resourceId: string }>> {
  try {
    const workspace = await requireWorkspace();
    const resourceId = await contributePlanToLibrary(workspace, planId);
    revalidatePath("/centre");
    revalidatePath("/today");
    return { ok: true, data: { resourceId } };
  } catch (error) {
    return failure(error, "The plan couldn't be shared to Centre Intelligence.");
  }
}
