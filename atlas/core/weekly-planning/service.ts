import { generateWeeklyPlan } from "@/core/ai/services/generate-weekly-plan";
import { regenerateSection } from "@/core/ai/services/regenerate-section";
import { gatherPlanContext } from "@/core/centre-intelligence/context";
import { emitAtlasEvent } from "@/core/events/bus";
import { chunkText } from "@/core/resources/chunker";
import {
  insertResource,
  insertResourceVersion,
  recordContribution,
  replaceResourceChunks,
} from "@/core/resources/repo";
import type {
  PlanSection,
  WeeklyPlan,
  WeeklyPlanContent,
  WeeklyPlanRequest,
  WeeklyPlanVersion,
  Workspace,
} from "@/lib/types";
import { PLAN_SECTION_LABELS } from "@/lib/types";
import { isDemoMode } from "@/lib/env";
import { demoInsertNote } from "@/lib/demo/store";
import { createServerSupabase } from "@/lib/supabase/server";
import { addDays, parseISODate, toISODate } from "@/lib/utils/dates";
import { newId } from "@/lib/utils/ids";

import { planToMarkdown } from "./markdown";
import {
  getPlan,
  getPlanWithContent,
  insertPlan,
  insertPlanVersion,
  listPlans,
  updatePlan,
} from "./repo";

function dayDatesFor(weekStart: string): string[] {
  const monday = parseISODate(weekStart);
  return [0, 1, 2, 3, 4].map((offset) => toISODate(addDays(monday, offset)));
}

/**
 * Prepare the upcoming week — the primary MVP promise.
 * Gathers Centre Intelligence, generates the plan (AI or deterministic),
 * versions it, saves the teacher's private notes, and announces it on the feed.
 */
export async function prepareWeek(
  workspace: Workspace,
  request: WeeklyPlanRequest,
): Promise<WeeklyPlan> {
  const context = await gatherPlanContext(workspace, {
    theme: request.theme,
    ageGroup: request.ageGroup,
  });

  const generated = await generateWeeklyPlan({
    centreName: workspace.centre.name,
    request,
    context,
    dayDates: dayDatesFor(request.weekStart),
  });

  const plan = await insertPlan({
    centreId: workspace.centre.id,
    weekStart: request.weekStart,
    weekEnd: request.weekEnd,
    theme: request.theme,
    ageGroup: request.ageGroup,
    className: request.className,
    status: "ready",
    createdBy: workspace.user.id,
  });

  await insertPlanVersion({
    weeklyPlanId: plan.id,
    versionNumber: 1,
    content: generated.content,
    changeSummary: generated.viaAI
      ? `Atlas prepared this week from ${generated.content.sources.length} centre resources.`
      : "Atlas drafted this week from your centre's templates.",
    createdBy: null,
    createdByAtlas: true,
  });
  await updatePlan(plan.id, { currentVersion: 1 });
  plan.currentVersion = 1;

  if (request.teacherNotes?.trim()) {
    await savePrivateNote(workspace, {
      weeklyPlanId: plan.id,
      title: `Notes for ${request.theme}`,
      content: request.teacherNotes.trim(),
    });
  }

  const materials = generated.content.materials;
  await emitAtlasEvent({
    name: "weekly_plan_generated",
    centreId: workspace.centre.id,
    actor: workspace.user,
    payload: {
      planId: plan.id,
      theme: request.theme,
      ageGroup: request.className ?? request.ageGroup,
      weekStart: request.weekStart,
      weekEnd: request.weekEnd,
      materialsCount: materials.length,
      materialsToPrepare: materials.filter((m) => !m.ready).length,
      observationCount: generated.content.observationOpportunities.length,
      sourceCount: generated.content.sources.length,
      degraded: generated.degraded,
    },
  });

  return plan;
}

/** Every manual save is a new version — teacher work is never overwritten. */
export async function savePlanEdits(
  workspace: Workspace,
  planId: string,
  content: WeeklyPlanContent,
  changeSummary?: string,
): Promise<WeeklyPlanVersion> {
  const plan = await getPlan(planId);
  if (!plan) throw new Error("Plan not found.");

  const nextVersion = plan.currentVersion + 1;
  const version = await insertPlanVersion({
    weeklyPlanId: planId,
    versionNumber: nextVersion,
    content,
    changeSummary: changeSummary ?? "Edited by teacher",
    createdBy: workspace.user.id,
    createdByName: workspace.user.fullName,
    createdByAtlas: false,
  });
  await updatePlan(planId, { currentVersion: nextVersion });

  await emitAtlasEvent({
    name: "weekly_plan_updated",
    centreId: workspace.centre.id,
    actor: workspace.user,
    payload: { planId, theme: plan.theme, changeSummary: version.changeSummary ?? "" },
  });

  return version;
}

export async function approvePlan(workspace: Workspace, planId: string): Promise<void> {
  const plan = await getPlan(planId);
  if (!plan) throw new Error("Plan not found.");
  await updatePlan(planId, { status: "approved" });
  await emitAtlasEvent({
    name: "weekly_plan_updated",
    centreId: workspace.centre.id,
    actor: workspace.user,
    payload: { planId, theme: plan.theme, changeSummary: "Approved" },
  });
}

/** Regenerate a single section; the result is saved as a new version. */
export async function regeneratePlanSection(
  workspace: Workspace,
  planId: string,
  section: PlanSection,
  instruction: string | null,
): Promise<WeeklyPlanVersion> {
  const loaded = await getPlanWithContent(planId);
  if (!loaded) throw new Error("Plan not found.");
  const { plan } = loaded;

  const request: WeeklyPlanRequest = {
    weekStart: plan.weekStart,
    weekEnd: plan.weekEnd,
    theme: plan.theme,
    ageGroup: plan.ageGroup,
    className: plan.className,
    teacherNotes: instruction,
  };
  const context = await gatherPlanContext(workspace, {
    theme: plan.theme,
    ageGroup: plan.ageGroup,
  });

  const { content } = await regenerateSection({
    centreName: workspace.centre.name,
    request,
    content: plan.content,
    section,
    instruction,
    context,
    dayDates: dayDatesFor(plan.weekStart),
    variant: plan.currentVersion, // rotates deterministic phrasing per attempt
  });

  const nextVersion = plan.currentVersion + 1;
  const version = await insertPlanVersion({
    weeklyPlanId: planId,
    versionNumber: nextVersion,
    content,
    changeSummary: `Atlas reworked “${PLAN_SECTION_LABELS[section]}”${instruction ? ` — ${instruction}` : ""}`,
    createdBy: null,
    createdByAtlas: true,
  });
  await updatePlan(planId, { currentVersion: nextVersion });

  await emitAtlasEvent({
    name: "section_regenerated",
    centreId: workspace.centre.id,
    actor: workspace.user,
    payload: { planId, theme: plan.theme, section },
  });

  return version;
}

/** Restore an older plan version by copying it forward as a new version. */
export async function restorePlanVersion(
  workspace: Workspace,
  planId: string,
  version: WeeklyPlanVersion,
): Promise<void> {
  await savePlanEdits(
    workspace,
    planId,
    version.content,
    `Restored version ${version.versionNumber}`,
  );
}

/** Share a finished plan back into Centre Intelligence as a reusable resource. */
export async function contributePlanToLibrary(
  workspace: Workspace,
  planId: string,
): Promise<string> {
  const loaded = await getPlanWithContent(planId);
  if (!loaded) throw new Error("Plan not found.");
  const { plan } = loaded;

  const markdown = planToMarkdown(plan, plan.content);
  const title = `Weekly plan — ${plan.theme}`;

  const resource = await insertResource({
    centreId: workspace.centre.id,
    title,
    description: `Contributed from the week of ${plan.weekStart} (${plan.ageGroup}).`,
    type: "weekly_plan",
    visibility: "centre",
    mimeType: "text/markdown",
    originalFilename: null,
    hasExtractedText: true,
    createdBy: workspace.user.id,
    createdByName: workspace.user.fullName,
    contributed: true,
  });

  const version = await insertResourceVersion({
    resourceId: resource.id,
    centreId: workspace.centre.id,
    versionNumber: 1,
    title,
    extractedText: markdown,
    changeNote: null,
    createdBy: workspace.user.id,
    createdByName: workspace.user.fullName,
    createdByAtlas: false,
  });
  await replaceResourceChunks(
    resource.id,
    workspace.centre.id,
    version.id,
    chunkText(markdown),
  );

  await recordContribution({
    centreId: workspace.centre.id,
    userId: workspace.user.id,
    userName: workspace.user.fullName,
    resourceId: resource.id,
    resourceTitle: title,
    eventType: "contributed",
  });
  await emitAtlasEvent({
    name: "teacher_contributed_resource",
    centreId: workspace.centre.id,
    actor: workspace.user,
    payload: { resourceId: resource.id, title },
  });

  return resource.id;
}

/** The plan the Today page cares about: this week or the nearest upcoming one. */
export async function getCurrentPlan(workspace: Workspace): Promise<WeeklyPlan | null> {
  const plans = await listPlans(workspace.centre.id);
  if (plans.length === 0) return null;
  const today = toISODate(new Date());
  const currentOrUpcoming = plans
    .filter((p) => p.weekEnd >= today)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return currentOrUpcoming[0] ?? plans[0];
}

async function savePrivateNote(
  workspace: Workspace,
  input: { weeklyPlanId: string | null; title: string | null; content: string },
): Promise<void> {
  if (isDemoMode()) {
    demoInsertNote({
      id: newId(),
      centreId: workspace.centre.id,
      userId: workspace.user.id,
      weeklyPlanId: input.weeklyPlanId,
      title: input.title,
      content: input.content,
      createdAt: new Date().toISOString(),
    });
    return;
  }
  const supabase = await createServerSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("private_teacher_notes").insert({
    centre_id: workspace.centre.id,
    user_id: workspace.user.id,
    weekly_plan_id: input.weeklyPlanId,
    title: input.title,
    content: input.content,
  });
  if (error) console.error(`[atlas] failed to save note: ${error.message}`);
}

export { getPlan, getPlanWithContent, listPlans };
