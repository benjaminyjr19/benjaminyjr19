import type {
  ContributionEvent,
  Resource,
  ResourceChunk,
  ResourceVersion,
  Tag,
} from "@/lib/types";
import type {
  ContributionEventRow,
  ResourceChunkRow,
  ResourceRow,
  ResourceTagRow,
  ResourceVersionRow,
  TagRow,
  UserRow,
} from "@/lib/types/database";
import { isDemoMode } from "@/lib/env";
import {
  demoCorpusChunks,
  demoEnsureTags,
  demoGetLatestVersion,
  demoGetResource,
  demoInsertContribution,
  demoInsertResource,
  demoInsertResourceVersion,
  demoListContributions,
  demoListResources,
  demoListResourceVersions,
  demoListTags,
  demoReplaceChunks,
  demoSetResourceTags,
  demoUpdateResource,
  demoUserName,
} from "@/lib/demo/store";
import { createServerSupabase } from "@/lib/supabase/server";
import { newId } from "@/lib/utils/ids";

import type { TextChunk } from "./chunker";

// ── Mapping ─────────────────────────────────────────────────────────────────

function mapTag(row: TagRow): Tag {
  return {
    id: row.id,
    centreId: row.centre_id,
    name: row.name,
    kind: row.kind as Tag["kind"],
  };
}

function mapResource(
  row: ResourceRow,
  tags: Tag[],
  userNames: Map<string, string>,
): Resource {
  return {
    id: row.id,
    centreId: row.centre_id,
    title: row.title,
    description: row.description,
    type: row.type as Resource["type"],
    status: row.status as Resource["status"],
    visibility: row.visibility as Resource["visibility"],
    filePath: row.file_path,
    mimeType: row.mime_type,
    originalFilename: row.original_filename,
    hasExtractedText: row.has_extracted_text,
    currentVersion: row.current_version,
    createdBy: row.created_by,
    createdByName: row.created_by ? (userNames.get(row.created_by) ?? null) : null,
    contributed: row.contributed,
    forkedFrom: row.forked_from,
    mergedInto: row.merged_into,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVersion(row: ResourceVersionRow, userNames: Map<string, string>): ResourceVersion {
  return {
    id: row.id,
    resourceId: row.resource_id,
    versionNumber: row.version_number,
    title: row.title,
    extractedText: row.extracted_text,
    changeNote: row.change_note,
    createdBy: row.created_by,
    createdByName: row.created_by ? (userNames.get(row.created_by) ?? null) : null,
    createdByAtlas: row.created_by_atlas,
    createdAt: row.created_at,
  };
}

async function centreUserNames(centreId: string): Promise<Map<string, string>> {
  const supabase = await createServerSupabase();
  if (!supabase) return new Map();
  const { data } = await supabase
    .from("centre_members")
    .select("user_id, users(full_name)")
    .eq("centre_id", centreId);
  const map = new Map<string, string>();
  const rows = (data ?? []) as unknown as Array<{
    user_id: string;
    users: Pick<UserRow, "full_name"> | null;
  }>;
  for (const row of rows) {
    if (row.users) map.set(row.user_id, row.users.full_name);
  }
  return map;
}

async function tagsForResources(
  resourceIds: string[],
): Promise<Map<string, Tag[]>> {
  const supabase = await createServerSupabase();
  const map = new Map<string, Tag[]>();
  if (!supabase || resourceIds.length === 0) return map;
  const { data } = await supabase
    .from("resource_tags")
    .select("resource_id, tags(*)")
    .in("resource_id", resourceIds);
  const rows = (data ?? []) as unknown as Array<
    Pick<ResourceTagRow, "resource_id"> & { tags: TagRow | null }
  >;
  for (const row of rows) {
    if (!row.tags) continue;
    const list = map.get(row.resource_id) ?? [];
    list.push(mapTag(row.tags));
    map.set(row.resource_id, list);
  }
  return map;
}

// ── Reads ───────────────────────────────────────────────────────────────────

export async function listResources(
  centreId: string,
  viewerId: string,
  options?: { includeArchived?: boolean },
): Promise<Resource[]> {
  if (isDemoMode()) {
    return demoListResources({ viewerId, includeArchived: options?.includeArchived });
  }

  const supabase = await createServerSupabase();
  if (!supabase) return [];
  let query = supabase
    .from("resources")
    .select("*")
    .eq("centre_id", centreId)
    .order("updated_at", { ascending: false });
  if (!options?.includeArchived) query = query.in("status", ["processing", "ready"]);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load resources: ${error.message}`);
  const rows = data as ResourceRow[];

  // RLS already hides other users' private resources; filter defensively too.
  const visible = rows.filter(
    (r) => r.visibility !== "private" || r.created_by === viewerId,
  );
  const [tagMap, names] = await Promise.all([
    tagsForResources(visible.map((r) => r.id)),
    centreUserNames(centreId),
  ]);
  return visible.map((r) => mapResource(r, tagMap.get(r.id) ?? [], names));
}

export async function getResource(resourceId: string): Promise<Resource | null> {
  if (isDemoMode()) return demoGetResource(resourceId);

  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .eq("id", resourceId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load resource: ${error.message}`);
  if (!data) return null;
  const row = data as ResourceRow;
  const [tagMap, names] = await Promise.all([
    tagsForResources([row.id]),
    centreUserNames(row.centre_id),
  ]);
  return mapResource(row, tagMap.get(row.id) ?? [], names);
}

export async function listResourceVersions(
  resourceId: string,
  centreId: string,
): Promise<ResourceVersion[]> {
  if (isDemoMode()) return demoListResourceVersions(resourceId);

  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("resource_versions")
    .select("*")
    .eq("resource_id", resourceId)
    .order("version_number", { ascending: false });
  if (error) throw new Error(`Failed to load versions: ${error.message}`);
  const names = await centreUserNames(centreId);
  return (data as ResourceVersionRow[]).map((v) => mapVersion(v, names));
}

export async function getLatestVersion(
  resourceId: string,
): Promise<ResourceVersion | null> {
  if (isDemoMode()) return demoGetLatestVersion(resourceId);

  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("resource_versions")
    .select("*")
    .eq("resource_id", resourceId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load version: ${error.message}`);
  return data ? mapVersion(data as ResourceVersionRow, new Map()) : null;
}

/** Chunk corpus for search/duplicates/planning — shared resources the viewer can see. */
export async function listCorpusChunks(
  centreId: string,
  viewerId: string,
): Promise<ResourceChunk[]> {
  if (isDemoMode()) return demoCorpusChunks(viewerId);

  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("resource_chunks")
    .select("id, resource_id, version_id, chunk_index, content, token_estimate")
    .eq("centre_id", centreId);
  if (error) throw new Error(`Failed to load chunks: ${error.message}`);
  return (data as ResourceChunkRow[]).map((c) => ({
    id: c.id,
    resourceId: c.resource_id,
    versionId: c.version_id,
    chunkIndex: c.chunk_index,
    content: c.content,
    tokenEstimate: c.token_estimate,
  }));
}

// ── Tags ────────────────────────────────────────────────────────────────────

export async function listTags(centreId: string): Promise<Tag[]> {
  if (isDemoMode()) return demoListTags();

  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("centre_id", centreId)
    .order("name");
  if (error) throw new Error(`Failed to load tags: ${error.message}`);
  return (data as TagRow[]).map(mapTag);
}

export async function ensureTags(
  centreId: string,
  names: string[],
  kind: Tag["kind"] = "custom",
): Promise<Tag[]> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (isDemoMode()) return demoEnsureTags(unique, kind);

  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const existing = await listTags(centreId);
  const byName = new Map(existing.map((t) => [t.name.toLowerCase(), t]));
  const resolved: Tag[] = [];
  const toInsert: Array<{ id: string; centre_id: string; name: string; kind: string }> = [];

  for (const name of unique) {
    const found = byName.get(name.toLowerCase());
    if (found) {
      resolved.push(found);
    } else {
      const id = newId();
      toInsert.push({ id, centre_id: centreId, name, kind });
      resolved.push({ id, centreId, name, kind });
    }
  }
  if (toInsert.length > 0) {
    const { error } = await supabase.from("tags").insert(toInsert);
    if (error) throw new Error(`Failed to create tags: ${error.message}`);
  }
  return resolved;
}

export async function setResourceTags(
  resourceId: string,
  tags: Tag[],
  suggestedBy: "atlas" | "teacher",
): Promise<void> {
  if (isDemoMode()) {
    demoSetResourceTags(resourceId, tags);
    return;
  }

  const supabase = await createServerSupabase();
  if (!supabase) return;
  await supabase.from("resource_tags").delete().eq("resource_id", resourceId);
  if (tags.length > 0) {
    const { error } = await supabase.from("resource_tags").insert(
      tags.map((t) => ({ resource_id: resourceId, tag_id: t.id, suggested_by: suggestedBy })),
    );
    if (error) throw new Error(`Failed to tag resource: ${error.message}`);
  }
}

// ── Writes ──────────────────────────────────────────────────────────────────

export interface NewResourceInput {
  centreId: string;
  title: string;
  description?: string | null;
  type: Resource["type"];
  visibility: Resource["visibility"];
  filePath?: string | null;
  mimeType?: string | null;
  originalFilename?: string | null;
  hasExtractedText: boolean;
  createdBy: string | null;
  createdByName?: string | null;
  contributed?: boolean;
  forkedFrom?: string | null;
}

export async function insertResource(input: NewResourceInput): Promise<Resource> {
  const nowISO = new Date().toISOString();
  const resource: Resource = {
    id: newId(),
    centreId: input.centreId,
    title: input.title,
    description: input.description ?? null,
    type: input.type,
    status: "ready",
    visibility: input.visibility,
    filePath: input.filePath ?? null,
    mimeType: input.mimeType ?? null,
    originalFilename: input.originalFilename ?? null,
    hasExtractedText: input.hasExtractedText,
    currentVersion: 1,
    createdBy: input.createdBy,
    createdByName:
      input.createdByName ?? (isDemoMode() ? demoUserName(input.createdBy) : null),
    contributed: input.contributed ?? false,
    forkedFrom: input.forkedFrom ?? null,
    mergedInto: null,
    tags: [],
    createdAt: nowISO,
    updatedAt: nowISO,
  };

  if (isDemoMode()) return demoInsertResource(resource);

  const supabase = await createServerSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("resources").insert({
    id: resource.id,
    centre_id: resource.centreId,
    title: resource.title,
    description: resource.description,
    type: resource.type,
    status: resource.status,
    visibility: resource.visibility,
    file_path: resource.filePath,
    mime_type: resource.mimeType,
    original_filename: resource.originalFilename,
    has_extracted_text: resource.hasExtractedText,
    current_version: 1,
    created_by: resource.createdBy,
    contributed: resource.contributed,
    forked_from: resource.forkedFrom,
  });
  if (error) throw new Error(`Failed to create resource: ${error.message}`);
  return resource;
}

export async function updateResource(
  resourceId: string,
  patch: Partial<
    Pick<
      Resource,
      | "title"
      | "description"
      | "type"
      | "status"
      | "visibility"
      | "contributed"
      | "currentVersion"
      | "mergedInto"
      | "forkedFrom"
      | "filePath"
      | "hasExtractedText"
    >
  >,
): Promise<void> {
  if (isDemoMode()) {
    demoUpdateResource(resourceId, patch);
    return;
  }

  const supabase = await createServerSupabase();
  if (!supabase) return;
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.type !== undefined) row.type = patch.type;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.visibility !== undefined) row.visibility = patch.visibility;
  if (patch.contributed !== undefined) row.contributed = patch.contributed;
  if (patch.currentVersion !== undefined) row.current_version = patch.currentVersion;
  if (patch.mergedInto !== undefined) row.merged_into = patch.mergedInto;
  if (patch.forkedFrom !== undefined) row.forked_from = patch.forkedFrom;
  if (patch.filePath !== undefined) row.file_path = patch.filePath;
  if (patch.hasExtractedText !== undefined) row.has_extracted_text = patch.hasExtractedText;

  const { error } = await supabase.from("resources").update(row).eq("id", resourceId);
  if (error) throw new Error(`Failed to update resource: ${error.message}`);
}

export async function insertResourceVersion(input: {
  resourceId: string;
  centreId: string;
  versionNumber: number;
  title: string;
  extractedText: string;
  changeNote: string | null;
  createdBy: string | null;
  createdByName?: string | null;
  createdByAtlas: boolean;
}): Promise<ResourceVersion> {
  const version: ResourceVersion = {
    id: newId(),
    resourceId: input.resourceId,
    versionNumber: input.versionNumber,
    title: input.title,
    extractedText: input.extractedText,
    changeNote: input.changeNote,
    createdBy: input.createdBy,
    createdByName:
      input.createdByName ?? (isDemoMode() ? demoUserName(input.createdBy) : null),
    createdByAtlas: input.createdByAtlas,
    createdAt: new Date().toISOString(),
  };

  if (isDemoMode()) return demoInsertResourceVersion(version);

  const supabase = await createServerSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("resource_versions").insert({
    id: version.id,
    resource_id: version.resourceId,
    version_number: version.versionNumber,
    title: version.title,
    extracted_text: version.extractedText,
    change_note: version.changeNote,
    created_by: version.createdBy,
    created_by_atlas: version.createdByAtlas,
  });
  if (error) throw new Error(`Failed to create version: ${error.message}`);
  return version;
}

/** Replace a resource's chunks with the latest version's chunks. */
export async function replaceResourceChunks(
  resourceId: string,
  centreId: string,
  versionId: string,
  chunks: TextChunk[],
): Promise<void> {
  if (isDemoMode()) {
    demoReplaceChunks(
      resourceId,
      versionId,
      chunks.map((c) => ({ index: c.index, content: c.content, tokenEstimate: c.tokenEstimate })),
    );
    return;
  }

  const supabase = await createServerSupabase();
  if (!supabase) return;
  await supabase.from("resource_chunks").delete().eq("resource_id", resourceId);
  if (chunks.length > 0) {
    const { error } = await supabase.from("resource_chunks").insert(
      chunks.map((c) => ({
        resource_id: resourceId,
        centre_id: centreId,
        version_id: versionId,
        chunk_index: c.index,
        content: c.content,
        token_estimate: c.tokenEstimate,
        // embedding intentionally null — pgvector column is ready, embeddings are post-MVP.
      })),
    );
    if (error) throw new Error(`Failed to store chunks: ${error.message}`);
  }
}

// ── Contribution events ─────────────────────────────────────────────────────

export async function recordContribution(input: {
  centreId: string;
  userId: string | null;
  userName?: string | null;
  resourceId: string | null;
  resourceTitle?: string | null;
  eventType: ContributionEvent["eventType"];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const event: ContributionEvent = {
    id: newId(),
    centreId: input.centreId,
    userId: input.userId,
    userName: input.userName ?? (isDemoMode() ? demoUserName(input.userId) : null),
    resourceId: input.resourceId,
    resourceTitle: input.resourceTitle ?? null,
    eventType: input.eventType,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString(),
  };

  if (isDemoMode()) {
    demoInsertContribution(event);
    return;
  }

  const supabase = await createServerSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("contribution_events").insert({
    id: event.id,
    centre_id: event.centreId,
    user_id: event.userId,
    resource_id: event.resourceId,
    event_type: event.eventType,
    metadata: event.metadata,
  });
  if (error) console.error(`[atlas] failed to record contribution: ${error.message}`);
}

export async function listRecentContributions(
  centreId: string,
  limit = 8,
): Promise<ContributionEvent[]> {
  if (isDemoMode()) return demoListContributions(limit);

  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("contribution_events")
    .select("*, users(full_name), resources(title)")
    .eq("centre_id", centreId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load contributions: ${error.message}`);

  return (
    data as Array<
      ContributionEventRow & {
        users: Pick<UserRow, "full_name"> | null;
        resources: { title: string } | null;
      }
    >
  ).map((row) => ({
    id: row.id,
    centreId: row.centre_id,
    userId: row.user_id,
    userName: row.users?.full_name ?? null,
    resourceId: row.resource_id,
    resourceTitle: row.resources?.title ?? null,
    eventType: row.event_type as ContributionEvent["eventType"],
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }));
}
