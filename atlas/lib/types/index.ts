/**
 * Atlas domain types.
 *
 * These are the app-level shapes used by services, components and the demo
 * store. Database row types live in `lib/types/database.ts`; mapping between
 * the two happens in the repository layer (`core/**` repos).
 */

// ── Workspace ───────────────────────────────────────────────────────────────

export interface Centre {
  id: string;
  name: string;
  timezone: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
}

export type MemberRole = "teacher" | "lead";

export interface CentreMember {
  centreId: string;
  userId: string;
  role: MemberRole;
}

/** Everything a request needs to act on behalf of a signed-in teacher. */
export interface Workspace {
  user: User;
  centre: Centre;
  role: MemberRole;
}

// ── Resources / Centre Intelligence ────────────────────────────────────────

export const RESOURCE_TYPES = [
  "curriculum",
  "lesson_template",
  "observation_template",
  "policy",
  "activity",
  "weekly_plan",
  "newsletter",
  "resource_list",
  "note",
  "other",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  curriculum: "Curriculum",
  lesson_template: "Lesson template",
  observation_template: "Observation template",
  policy: "Policy",
  activity: "Activity",
  weekly_plan: "Weekly plan",
  newsletter: "Newsletter",
  resource_list: "Resource list",
  note: "Note",
  other: "Document",
};

export type ResourceStatus = "processing" | "ready" | "archived" | "merged";

/** `centre` — shared in Centre Intelligence. `private` — visible to the author only. */
export type ResourceVisibility = "centre" | "private";

export type TagKind = "domain" | "age_group" | "format" | "custom";

export interface Tag {
  id: string;
  centreId: string;
  name: string;
  kind: TagKind;
}

export interface Resource {
  id: string;
  centreId: string;
  title: string;
  description: string | null;
  type: ResourceType;
  status: ResourceStatus;
  visibility: ResourceVisibility;
  filePath: string | null;
  mimeType: string | null;
  originalFilename: string | null;
  /** Empty string when the parser could not extract text (original file still stored). */
  hasExtractedText: boolean;
  currentVersion: number;
  createdBy: string | null;
  createdByName: string | null;
  /** True when a teacher explicitly contributed this to Centre Intelligence. */
  contributed: boolean;
  forkedFrom: string | null;
  mergedInto: string | null;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface ResourceVersion {
  id: string;
  resourceId: string;
  versionNumber: number;
  title: string;
  extractedText: string;
  changeNote: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdByAtlas: boolean;
  createdAt: string;
}

export interface ResourceChunk {
  id: string;
  resourceId: string;
  versionId: string;
  chunkIndex: number;
  content: string;
  tokenEstimate: number;
  // pgvector-ready: `embedding vector(1536)` exists in the schema but is not
  // populated in the MVP. Search falls back to full-text / keyword matching.
}

// ── Weekly planning ─────────────────────────────────────────────────────────

export type WeeklyPlanStatus = "generating" | "ready" | "approved";

export interface WeeklyPlan {
  id: string;
  centreId: string;
  weekStart: string; // ISO date (Monday)
  weekEnd: string; // ISO date (Friday)
  theme: string;
  ageGroup: string;
  className: string | null;
  status: WeeklyPlanStatus;
  currentVersion: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyPlanVersion {
  id: string;
  weeklyPlanId: string;
  versionNumber: number;
  content: WeeklyPlanContent;
  changeSummary: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdByAtlas: boolean;
  createdAt: string;
}

export interface WeeklyPlanWithContent extends WeeklyPlan {
  content: WeeklyPlanContent;
}

export interface ActivityBlock {
  id: string;
  period: "morning" | "midday" | "afternoon";
  title: string;
  description: string;
  materials: string[];
}

export interface DayPlan {
  /** ISO date for the day. */
  date: string;
  /** e.g. "Monday" */
  label: string;
  title: string;
  blocks: ActivityBlock[];
}

export interface MaterialItem {
  id: string;
  item: string;
  detail: string | null;
  day: string | null; // "Monday" … or null for whole week
  ready: boolean;
}

export interface ObservationOpportunity {
  id: string;
  focus: string;
  prompt: string;
  day: string | null;
}

export interface RainyDayAlternative {
  id: string;
  title: string;
  description: string;
  replaces: string | null;
}

export interface PlanSource {
  resourceId: string;
  title: string;
  usage: string;
}

export interface WeeklyPlanContent {
  overview: string;
  learningGoals: string[];
  days: DayPlan[];
  materials: MaterialItem[];
  observationOpportunities: ObservationOpportunity[];
  rainyDayAlternatives: RainyDayAlternative[];
  reflectionPrompts: string[];
  sources: PlanSource[];
}

/** Editable sections of a weekly plan — used by the editor and regeneration. */
export const PLAN_SECTIONS = [
  "overview",
  "learningGoals",
  "days",
  "materials",
  "observationOpportunities",
  "rainyDayAlternatives",
  "reflectionPrompts",
] as const;

export type PlanSection = (typeof PLAN_SECTIONS)[number];

export const PLAN_SECTION_LABELS: Record<PlanSection, string> = {
  overview: "Weekly overview",
  learningGoals: "Learning goals",
  days: "Daily plans",
  materials: "Materials checklist",
  observationOpportunities: "Observation opportunities",
  rainyDayAlternatives: "Rainy-day alternatives",
  reflectionPrompts: "Reflection prompts",
};

export interface WeeklyPlanRequest {
  weekStart: string;
  weekEnd: string;
  theme: string;
  ageGroup: string;
  className: string | null;
  teacherNotes: string | null;
}

// ── Events & Atlas Feed ─────────────────────────────────────────────────────

export const ATLAS_EVENTS = [
  "resource_uploaded",
  "resource_parsed",
  "duplicate_detected",
  "weekly_plan_generated",
  "weekly_plan_updated",
  "section_regenerated",
  "teacher_contributed_resource",
  "resource_version_created",
  "feed_item_created",
] as const;

export type AtlasEventName = (typeof ATLAS_EVENTS)[number];

export type FeedItemType =
  | "week_ready"
  | "plan_updated"
  | "materials_ready"
  | "observations_ready"
  | "weather_adjustment"
  | "resources_added"
  | "duplicate_found"
  | "contribution"
  | "version_created"
  | "notice";

export type FeedItemStatus = "unread" | "reviewed" | "dismissed";

export interface FeedItem {
  id: string;
  centreId: string;
  type: FeedItemType;
  title: string;
  summary: string;
  reviewMinutes: number | null;
  actionLabel: string | null;
  actionHref: string | null;
  status: FeedItemStatus;
  event: AtlasEventName | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── Duplicates ──────────────────────────────────────────────────────────────

export interface DuplicateSuggestion {
  /** Feed item id carrying this suggestion (duplicates live on the feed, not a separate table). */
  feedItemId: string;
  newResourceId: string;
  newResourceTitle: string;
  existingResourceId: string;
  existingResourceTitle: string;
  /** 0..1 */
  similarity: number;
}

export type DuplicateDecision = "merge" | "fork" | "keep_separate";

// ── Notes & contributions ───────────────────────────────────────────────────

export interface PrivateTeacherNote {
  id: string;
  centreId: string;
  userId: string;
  weeklyPlanId: string | null;
  title: string | null;
  content: string;
  createdAt: string;
}

export type ContributionEventType =
  | "uploaded"
  | "contributed"
  | "edited"
  | "merged"
  | "forked";

export interface ContributionEvent {
  id: string;
  centreId: string;
  userId: string | null;
  userName: string | null;
  resourceId: string | null;
  resourceTitle: string | null;
  eventType: ContributionEventType;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── Search ──────────────────────────────────────────────────────────────────

export interface SearchResult {
  resourceId: string;
  title: string;
  type: ResourceType;
  snippet: string;
  tags: Tag[];
  score: number;
  updatedAt: string;
}
