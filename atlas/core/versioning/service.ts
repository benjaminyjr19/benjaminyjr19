import { emitAtlasEvent } from "@/core/events/bus";
import { chunkText } from "@/core/resources/chunker";
import {
  getLatestVersion,
  insertResourceVersion,
  replaceResourceChunks,
  updateResource,
} from "@/core/resources/repo";
import type { Resource, ResourceVersion, User } from "@/lib/types";

/**
 * Versioning rules for teacher work:
 *  - every meaningful edit creates a new version — nothing is overwritten silently;
 *  - restoring an old version is itself a new version (history stays linear);
 *  - the resource's chunks always reflect the latest version so search stays honest.
 */
export async function createResourceVersion(input: {
  resource: Resource;
  title: string;
  extractedText: string;
  changeNote: string | null;
  actor: User | null;
  createdByAtlas: boolean;
  reason: "edit" | "merge" | "restore";
}): Promise<ResourceVersion> {
  const { resource } = input;
  const nextNumber = resource.currentVersion + 1;

  const version = await insertResourceVersion({
    resourceId: resource.id,
    centreId: resource.centreId,
    versionNumber: nextNumber,
    title: input.title,
    extractedText: input.extractedText,
    changeNote: input.changeNote,
    createdBy: input.actor?.id ?? null,
    createdByName: input.actor?.fullName ?? null,
    createdByAtlas: input.createdByAtlas,
  });

  await updateResource(resource.id, {
    title: input.title,
    currentVersion: nextNumber,
    hasExtractedText: input.extractedText.trim().length > 0,
  });

  await replaceResourceChunks(
    resource.id,
    resource.centreId,
    version.id,
    chunkText(input.extractedText),
  );

  await emitAtlasEvent({
    name: "resource_version_created",
    centreId: resource.centreId,
    actor: input.actor,
    payload: {
      resourceId: resource.id,
      title: input.title,
      versionNumber: nextNumber,
      reason: input.reason,
    },
  });

  return version;
}

/** Restore an older version by copying it forward as a new version. */
export async function restoreResourceVersion(input: {
  resource: Resource;
  version: ResourceVersion;
  actor: User | null;
}): Promise<ResourceVersion> {
  return createResourceVersion({
    resource: input.resource,
    title: input.version.title,
    extractedText: input.version.extractedText,
    changeNote: `Restored version ${input.version.versionNumber}`,
    actor: input.actor,
    createdByAtlas: false,
    reason: "restore",
  });
}

export { getLatestVersion };
