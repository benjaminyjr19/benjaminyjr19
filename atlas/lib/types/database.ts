/**
 * Row shapes matching `supabase/migrations`. The repository layer maps these
 * to the domain types in `lib/types`.
 *
 * TODO: replace with generated types (`supabase gen types typescript`) once a
 * project is linked — these are hand-kept in sync for the MVP.
 */

export interface CentreRow {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
}

export interface UserRow {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface CentreMemberRow {
  centre_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface ResourceRow {
  id: string;
  centre_id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  visibility: string;
  file_path: string | null;
  mime_type: string | null;
  original_filename: string | null;
  has_extracted_text: boolean;
  current_version: number;
  created_by: string | null;
  contributed: boolean;
  forked_from: string | null;
  merged_into: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResourceVersionRow {
  id: string;
  resource_id: string;
  version_number: number;
  title: string;
  extracted_text: string;
  change_note: string | null;
  created_by: string | null;
  created_by_atlas: boolean;
  created_at: string;
}

export interface ResourceChunkRow {
  id: string;
  resource_id: string;
  version_id: string;
  chunk_index: number;
  content: string;
  token_estimate: number;
  embedding: unknown | null;
  created_at: string;
}

export interface TagRow {
  id: string;
  centre_id: string;
  name: string;
  kind: string;
  created_at: string;
}

export interface ResourceTagRow {
  resource_id: string;
  tag_id: string;
  suggested_by: string;
  created_at: string;
}

export interface WeeklyPlanRow {
  id: string;
  centre_id: string;
  week_start: string;
  week_end: string;
  theme: string;
  age_group: string;
  class_name: string | null;
  status: string;
  current_version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyPlanVersionRow {
  id: string;
  weekly_plan_id: string;
  version_number: number;
  content: unknown;
  change_summary: string | null;
  created_by: string | null;
  created_by_atlas: boolean;
  created_at: string;
}

export interface AtlasFeedItemRow {
  id: string;
  centre_id: string;
  type: string;
  title: string;
  summary: string;
  review_minutes: number | null;
  action_label: string | null;
  action_href: string | null;
  status: string;
  event: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PrivateTeacherNoteRow {
  id: string;
  centre_id: string;
  user_id: string;
  weekly_plan_id: string | null;
  title: string | null;
  content: string;
  created_at: string;
}

export interface ContributionEventRow {
  id: string;
  centre_id: string;
  user_id: string | null;
  resource_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
