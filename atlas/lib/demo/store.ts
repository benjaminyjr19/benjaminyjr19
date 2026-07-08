/**
 * In-memory workspace used when Supabase is not configured ("preview mode").
 *
 * Implements the same operations as the Supabase-backed repositories so the
 * whole product — upload, parse, plan, edit, contribute — works end to end
 * with zero external services. State lives on `globalThis` so it survives
 * hot reloads within a dev server process. It resets on restart by design.
 */

import type {
  Centre,
  ContributionEvent,
  FeedItem,
  FeedItemStatus,
  PrivateTeacherNote,
  Resource,
  ResourceChunk,
  ResourceVersion,
  Tag,
  User,
  WeeklyPlan,
  WeeklyPlanVersion,
} from "@/lib/types";
import { chunkText } from "@/core/resources/chunker";
import { newId } from "@/lib/utils/ids";
import {
  DEMO_CURRENT_USER_ID,
  demoCentre,
  demoChunkSource,
  demoContributionEvents,
  demoFeedItems,
  demoNotes,
  demoPlan,
  demoPlanVersions,
  demoResources,
  demoResourceVersions,
  demoTags,
  demoUsers,
} from "./fixtures";

interface DemoState {
  centre: Centre;
  users: User[];
  currentUserId: string;
  tags: Tag[];
  resources: Resource[];
  resourceVersions: ResourceVersion[];
  chunks: ResourceChunk[];
  plans: WeeklyPlan[];
  planVersions: WeeklyPlanVersion[];
  feedItems: FeedItem[];
  contributions: ContributionEvent[];
  notes: PrivateTeacherNote[];
}

function buildInitialState(): DemoState {
  const chunks: ResourceChunk[] = demoChunkSource.flatMap(
    ({ resourceId, versionId, text }) =>
      chunkText(text).map((c) => ({
        id: newId(),
        resourceId,
        versionId,
        chunkIndex: c.index,
        content: c.content,
        tokenEstimate: c.tokenEstimate,
      })),
  );

  // Deep-clone fixtures so mutations never touch module constants.
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

  return {
    centre: clone(demoCentre),
    users: clone(demoUsers),
    currentUserId: DEMO_CURRENT_USER_ID,
    tags: clone(demoTags),
    resources: clone(demoResources),
    resourceVersions: clone(demoResourceVersions),
    chunks,
    plans: clone([demoPlan]),
    planVersions: clone(demoPlanVersions),
    feedItems: clone(demoFeedItems),
    contributions: clone(demoContributionEvents),
    notes: clone(demoNotes),
  };
}

const globalStore = globalThis as unknown as { __atlasDemoState?: DemoState };

export function demoState(): DemoState {
  if (!globalStore.__atlasDemoState) {
    globalStore.__atlasDemoState = buildInitialState();
  }
  return globalStore.__atlasDemoState;
}

// ── Workspace ───────────────────────────────────────────────────────────────

export function demoWorkspace() {
  const state = demoState();
  const user = state.users.find((u) => u.id === state.currentUserId)!;
  return { user, centre: state.centre, role: "teacher" as const };
}

export function demoUserName(userId: string | null): string | null {
  if (!userId) return null;
  return demoState().users.find((u) => u.id === userId)?.fullName ?? null;
}

// ── Feed ────────────────────────────────────────────────────────────────────

export function demoListFeedItems(options?: {
  statuses?: FeedItemStatus[];
  limit?: number;
}): FeedItem[] {
  const state = demoState();
  let items = [...state.feedItems].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  if (options?.statuses) {
    items = items.filter((i) => options.statuses!.includes(i.status));
  }
  return options?.limit ? items.slice(0, options.limit) : items;
}

export function demoGetFeedItem(feedItemId: string): FeedItem | null {
  return demoState().feedItems.find((i) => i.id === feedItemId) ?? null;
}

export function demoInsertFeedItem(item: FeedItem): FeedItem {
  demoState().feedItems.unshift(item);
  return item;
}

export function demoSetFeedItemStatus(feedItemId: string, status: FeedItemStatus): void {
  const item = demoGetFeedItem(feedItemId);
  if (item) item.status = status;
}

// ── Tags ────────────────────────────────────────────────────────────────────

export function demoListTags(): Tag[] {
  return [...demoState().tags];
}

/** Find-or-create tags by name; returns the resolved tags. */
export function demoEnsureTags(names: string[], kind: Tag["kind"] = "custom"): Tag[] {
  const state = demoState();
  return names.map((name) => {
    const existing = state.tags.find(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) return existing;
    const created: Tag = { id: newId(), centreId: state.centre.id, name, kind };
    state.tags.push(created);
    return created;
  });
}

// ── Resources ───────────────────────────────────────────────────────────────

export interface DemoResourceFilter {
  viewerId: string;
  includeArchived?: boolean;
}

export function demoListResources(filter: DemoResourceFilter): Resource[] {
  return demoState()
    .resources.filter((r) => {
      if (!filter.includeArchived && (r.status === "archived" || r.status === "merged"))
        return false;
      if (r.visibility === "private" && r.createdBy !== filter.viewerId) return false;
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function demoGetResource(resourceId: string): Resource | null {
  return demoState().resources.find((r) => r.id === resourceId) ?? null;
}

export function demoInsertResource(resource: Resource): Resource {
  demoState().resources.unshift(resource);
  return resource;
}

export function demoUpdateResource(
  resourceId: string,
  patch: Partial<Resource>,
): Resource | null {
  const resource = demoGetResource(resourceId);
  if (!resource) return null;
  Object.assign(resource, patch, { updatedAt: new Date().toISOString() });
  return resource;
}

export function demoSetResourceTags(resourceId: string, tags: Tag[]): void {
  const resource = demoGetResource(resourceId);
  if (resource) resource.tags = tags;
}

export function demoListResourceVersions(resourceId: string): ResourceVersion[] {
  return demoState()
    .resourceVersions.filter((v) => v.resourceId === resourceId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

export function demoInsertResourceVersion(version: ResourceVersion): ResourceVersion {
  demoState().resourceVersions.push(version);
  return version;
}

export function demoGetLatestVersion(resourceId: string): ResourceVersion | null {
  return demoListResourceVersions(resourceId)[0] ?? null;
}

export function demoReplaceChunks(
  resourceId: string,
  versionId: string,
  parts: Array<{ index: number; content: string; tokenEstimate: number }>,
): void {
  const state = demoState();
  state.chunks = state.chunks.filter((c) => c.resourceId !== resourceId);
  for (const part of parts) {
    state.chunks.push({
      id: newId(),
      resourceId,
      versionId,
      chunkIndex: part.index,
      content: part.content,
      tokenEstimate: part.tokenEstimate,
    });
  }
}

/** All chunks for shared (non-private, non-archived) resources — search/duplicate corpus. */
export function demoCorpusChunks(viewerId: string): ResourceChunk[] {
  const visible = new Set(demoListResources({ viewerId }).map((r) => r.id));
  return demoState().chunks.filter((c) => visible.has(c.resourceId));
}

// ── Weekly plans ────────────────────────────────────────────────────────────

export function demoListPlans(): WeeklyPlan[] {
  return [...demoState().plans].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

export function demoGetPlan(planId: string): WeeklyPlan | null {
  return demoState().plans.find((p) => p.id === planId) ?? null;
}

export function demoInsertPlan(plan: WeeklyPlan): WeeklyPlan {
  demoState().plans.unshift(plan);
  return plan;
}

export function demoUpdatePlan(
  planId: string,
  patch: Partial<WeeklyPlan>,
): WeeklyPlan | null {
  const plan = demoGetPlan(planId);
  if (!plan) return null;
  Object.assign(plan, patch, { updatedAt: new Date().toISOString() });
  return plan;
}

export function demoListPlanVersions(planId: string): WeeklyPlanVersion[] {
  return demoState()
    .planVersions.filter((v) => v.weeklyPlanId === planId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

export function demoInsertPlanVersion(version: WeeklyPlanVersion): WeeklyPlanVersion {
  demoState().planVersions.push(version);
  return version;
}

// ── Contributions & notes ───────────────────────────────────────────────────

export function demoListContributions(limit = 10): ContributionEvent[] {
  return [...demoState().contributions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function demoInsertContribution(event: ContributionEvent): ContributionEvent {
  demoState().contributions.unshift(event);
  return event;
}

export function demoInsertNote(note: PrivateTeacherNote): PrivateTeacherNote {
  demoState().notes.push(note);
  return note;
}
