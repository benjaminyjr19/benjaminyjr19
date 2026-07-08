import { classifyResource } from "@/core/ai/services/classify-resource";
import {
  detectDuplicates,
  type DuplicateMatch,
} from "@/core/ai/services/detect-duplicates";
import { suggestTags } from "@/core/ai/services/suggest-tags";
import { emitAtlasEvent } from "@/core/events/bus";
import type { Resource, ResourceVisibility, Workspace } from "@/lib/types";

import { chunkText } from "./chunker";
import { parseDocument } from "./parser";
import {
  ensureTags,
  getLatestVersion,
  getResource,
  insertResource,
  insertResourceVersion,
  listCorpusChunks,
  listResources,
  listTags,
  recordContribution,
  replaceResourceChunks,
  setResourceTags,
  updateResource,
} from "./repo";
import { storeOriginalFile } from "./storage";

export interface IngestResult {
  resource: Resource;
  duplicate: DuplicateMatch | null;
  parserWarning: string | null;
}

/**
 * The upload pipeline — the "Atlas works" half of the product:
 * store → parse → version → chunk → classify → tag → duplicate-check → events.
 * Teachers only see the outcome: a filed, tagged, searchable resource.
 */
export async function ingestUpload(
  workspace: Workspace,
  file: { filename: string; mimeType: string; buffer: Buffer },
): Promise<IngestResult> {
  const parsed = await parseDocument({
    buffer: file.buffer,
    mimeType: file.mimeType,
    filename: file.filename,
  });

  const title = titleFromUpload(file.filename, parsed.text);

  // Privacy-conscious default: uploads start private; the teacher chooses to
  // share in the moment ("Would you like other teachers to benefit?").
  const resource = await insertResource({
    centreId: workspace.centre.id,
    title,
    type: "other",
    visibility: "private",
    mimeType: file.mimeType,
    originalFilename: file.filename,
    hasExtractedText: parsed.text.length > 0,
    createdBy: workspace.user.id,
    createdByName: workspace.user.fullName,
  });

  const filePath = await storeOriginalFile({
    centreId: workspace.centre.id,
    resourceId: resource.id,
    filename: file.filename,
    mimeType: file.mimeType,
    buffer: file.buffer,
  });
  if (filePath) {
    await updateResource(resource.id, { filePath });
    resource.filePath = filePath;
  }

  await emitAtlasEvent({
    name: "resource_uploaded",
    centreId: workspace.centre.id,
    actor: workspace.user,
    payload: { resourceId: resource.id, title },
  });

  const version = await insertResourceVersion({
    resourceId: resource.id,
    centreId: workspace.centre.id,
    versionNumber: 1,
    title,
    extractedText: parsed.text,
    changeNote: null,
    createdBy: workspace.user.id,
    createdByName: workspace.user.fullName,
    createdByAtlas: false,
  });
  await replaceResourceChunks(
    resource.id,
    workspace.centre.id,
    version.id,
    chunkText(parsed.text),
  );

  const finished = await organizeResource(workspace, resource.id, {
    title,
    text: parsed.text,
    filename: file.filename,
  });

  await recordContribution({
    centreId: workspace.centre.id,
    userId: workspace.user.id,
    userName: workspace.user.fullName,
    resourceId: resource.id,
    resourceTitle: title,
    eventType: "uploaded",
  });

  return {
    resource: finished.resource,
    duplicate: finished.duplicate,
    parserWarning: parsed.warning ?? null,
  };
}

/** Create a resource from a typed note (no file). */
export async function createNoteResource(
  workspace: Workspace,
  input: { title: string; content: string },
): Promise<IngestResult> {
  const title = input.title.trim() || "Untitled note";
  const text = input.content.trim();

  const resource = await insertResource({
    centreId: workspace.centre.id,
    title,
    type: "note",
    visibility: "private",
    mimeType: "text/plain",
    originalFilename: null,
    hasExtractedText: text.length > 0,
    createdBy: workspace.user.id,
    createdByName: workspace.user.fullName,
  });

  const version = await insertResourceVersion({
    resourceId: resource.id,
    centreId: workspace.centre.id,
    versionNumber: 1,
    title,
    extractedText: text,
    changeNote: null,
    createdBy: workspace.user.id,
    createdByName: workspace.user.fullName,
    createdByAtlas: false,
  });
  await replaceResourceChunks(resource.id, workspace.centre.id, version.id, chunkText(text));

  const finished = await organizeResource(workspace, resource.id, {
    title,
    text,
    filename: null,
  });

  await recordContribution({
    centreId: workspace.centre.id,
    userId: workspace.user.id,
    userName: workspace.user.fullName,
    resourceId: resource.id,
    resourceTitle: title,
    eventType: "uploaded",
  });

  return { resource: finished.resource, duplicate: finished.duplicate, parserWarning: null };
}

/**
 * Atlas's organisation pass: classify, tag, duplicate-check, announce.
 * Shared by file uploads and typed notes.
 */
async function organizeResource(
  workspace: Workspace,
  resourceId: string,
  input: { title: string; text: string; filename: string | null },
): Promise<{ resource: Resource; duplicate: DuplicateMatch | null }> {
  const classification = await classifyResource({
    title: input.title,
    filename: input.filename,
    text: input.text,
  });
  await updateResource(resourceId, { type: classification.type });

  const existingTags = await listTags(workspace.centre.id);
  const tagNames = await suggestTags({
    title: input.title,
    text: input.text,
    existingTags: existingTags.map((t) => t.name),
  });
  const tags = await ensureTags(workspace.centre.id, tagNames);
  await setResourceTags(resourceId, tags, "atlas");

  // Duplicate check against the shared corpus (deterministic — see core/duplicates).
  const duplicate = await findDuplicateFor(workspace, resourceId, input);

  await emitAtlasEvent({
    name: "resource_parsed",
    centreId: workspace.centre.id,
    actor: workspace.user,
    payload: {
      resourceId,
      title: input.title,
      type: classification.type,
      tagNames,
      hasExtractedText: input.text.length > 0,
    },
  });

  if (duplicate) {
    await emitAtlasEvent({
      name: "duplicate_detected",
      centreId: workspace.centre.id,
      actor: workspace.user,
      payload: {
        newResourceId: resourceId,
        newResourceTitle: input.title,
        existingResourceId: duplicate.resourceId,
        existingResourceTitle: duplicate.title,
        similarity: duplicate.similarity,
      },
    });
  }

  const resource = (await getResource(resourceId))!;
  return { resource, duplicate };
}

async function findDuplicateFor(
  workspace: Workspace,
  resourceId: string,
  input: { title: string; text: string },
): Promise<DuplicateMatch | null> {
  const [resources, chunks] = await Promise.all([
    listResources(workspace.centre.id, workspace.user.id),
    listCorpusChunks(workspace.centre.id, workspace.user.id),
  ]);

  const textByResource = new Map<string, string>();
  for (const chunk of chunks) {
    textByResource.set(
      chunk.resourceId,
      `${textByResource.get(chunk.resourceId) ?? ""}\n${chunk.content}`,
    );
  }

  const corpus = resources
    .filter((r) => r.id !== resourceId && r.status === "ready")
    .map((r) => ({
      resourceId: r.id,
      title: r.title,
      text: textByResource.get(r.id) ?? "",
    }));

  const matches = detectDuplicates(input, corpus);
  return matches[0] ?? null;
}

/** "Would you like other teachers in your centre to benefit from this?" → yes. */
export async function contributeToCentre(
  workspace: Workspace,
  resourceId: string,
): Promise<void> {
  const resource = await getResource(resourceId);
  if (!resource) throw new Error("Resource not found.");

  await updateResource(resourceId, { visibility: "centre", contributed: true });
  await recordContribution({
    centreId: workspace.centre.id,
    userId: workspace.user.id,
    userName: workspace.user.fullName,
    resourceId,
    resourceTitle: resource.title,
    eventType: "contributed",
  });
  await emitAtlasEvent({
    name: "teacher_contributed_resource",
    centreId: workspace.centre.id,
    actor: workspace.user,
    payload: { resourceId, title: resource.title },
  });
}

/** → keep private. */
export async function keepPrivate(resourceId: string): Promise<void> {
  await updateResource(resourceId, { visibility: "private" });
}

export async function setResourceVisibility(
  workspace: Workspace,
  resourceId: string,
  visibility: ResourceVisibility,
): Promise<void> {
  if (visibility === "centre") {
    await contributeToCentre(workspace, resourceId);
  } else {
    await keepPrivate(resourceId);
  }
}

/** Derive a presentable title from the filename (or the first short text line). */
function titleFromUpload(filename: string, text: string): string {
  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean);
  if (firstLine && firstLine.length >= 8 && firstLine.length <= 90 && !firstLine.endsWith(".")) {
    return firstLine;
  }
  const stem = filename.replace(/\.[^.]+$/, "");
  const cleaned = stem.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Untitled document";
  return cleaned
    .split(" ")
    .map((word) => (word.length > 2 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export { getLatestVersion, getResource, listResources, listTags };
