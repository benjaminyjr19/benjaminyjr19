"use server";

import { revalidatePath } from "next/cache";

import { resolveDuplicate } from "@/core/duplicates/service";
import {
  contributeToCentre,
  createNoteResource,
  getResource,
  keepPrivate,
} from "@/core/resources/service";
import { ensureTags, listResourceVersions, setResourceTags } from "@/core/resources/repo";
import { createResourceVersion, restoreResourceVersion } from "@/core/versioning/service";
import { requireWorkspace } from "@/core/workspace/service";
import type { DuplicateDecision } from "@/lib/types";

import type { ActionResult } from "./plans";

function failure<T>(error: unknown, fallback: string): ActionResult<T> {
  console.error("[atlas:action]", error);
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

/** "Would you like other teachers in your centre to benefit from this?" */
export async function setResourceSharingAction(
  resourceId: string,
  share: boolean,
): Promise<ActionResult> {
  try {
    const workspace = await requireWorkspace();
    if (share) {
      await contributeToCentre(workspace, resourceId);
    } else {
      await keepPrivate(resourceId);
    }
    revalidatePath("/centre");
    revalidatePath(`/centre/${resourceId}`);
    revalidatePath("/today");
    return { ok: true };
  } catch (error) {
    return failure(error, "Sharing preference couldn't be saved.");
  }
}

export async function createNoteAction(input: {
  title: string;
  content: string;
}): Promise<ActionResult<{ resourceId: string; duplicateTitle: string | null }>> {
  try {
    const workspace = await requireWorkspace();
    if (!input.content.trim()) return { ok: false, error: "Write something first." };
    const result = await createNoteResource(workspace, input);
    revalidatePath("/centre");
    return {
      ok: true,
      data: {
        resourceId: result.resource.id,
        duplicateTitle: result.duplicate?.title ?? null,
      },
    };
  } catch (error) {
    return failure(error, "The note couldn't be saved.");
  }
}

export async function editResourceTextAction(input: {
  resourceId: string;
  title: string;
  text: string;
  changeNote: string | null;
}): Promise<ActionResult<{ version: number }>> {
  try {
    const workspace = await requireWorkspace();
    const resource = await getResource(input.resourceId);
    if (!resource) return { ok: false, error: "Resource not found." };
    const version = await createResourceVersion({
      resource,
      title: input.title.trim() || resource.title,
      extractedText: input.text,
      changeNote: input.changeNote,
      actor: workspace.user,
      createdByAtlas: false,
      reason: "edit",
    });
    revalidatePath(`/centre/${input.resourceId}`);
    revalidatePath("/centre");
    return { ok: true, data: { version: version.versionNumber } };
  } catch (error) {
    return failure(error, "Your edit couldn't be saved.");
  }
}

export async function restoreResourceVersionAction(
  resourceId: string,
  versionNumber: number,
): Promise<ActionResult> {
  try {
    const workspace = await requireWorkspace();
    const resource = await getResource(resourceId);
    if (!resource) return { ok: false, error: "Resource not found." };
    const versions = await listResourceVersions(resourceId, workspace.centre.id);
    const target = versions.find((v) => v.versionNumber === versionNumber);
    if (!target) return { ok: false, error: "Version not found." };
    await restoreResourceVersion({ resource, version: target, actor: workspace.user });
    revalidatePath(`/centre/${resourceId}`);
    return { ok: true };
  } catch (error) {
    return failure(error, "The version couldn't be restored.");
  }
}

export async function updateResourceTagsAction(
  resourceId: string,
  tagNames: string[],
): Promise<ActionResult> {
  try {
    const workspace = await requireWorkspace();
    const tags = await ensureTags(workspace.centre.id, tagNames);
    await setResourceTags(resourceId, tags, "teacher");
    revalidatePath(`/centre/${resourceId}`);
    revalidatePath("/centre");
    return { ok: true };
  } catch (error) {
    return failure(error, "Tags couldn't be updated.");
  }
}

export async function resolveDuplicateAction(input: {
  feedItemId: string | null;
  newResourceId: string;
  existingResourceId: string;
  decision: DuplicateDecision;
}): Promise<ActionResult> {
  try {
    const workspace = await requireWorkspace();
    await resolveDuplicate(workspace, input);
    revalidatePath("/review");
    revalidatePath("/centre");
    revalidatePath("/today");
    return { ok: true };
  } catch (error) {
    return failure(error, "The duplicate couldn't be resolved.");
  }
}
