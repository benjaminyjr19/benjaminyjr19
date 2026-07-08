import { getFeedItem, listFeedItems, setFeedItemStatus } from "@/core/events/feed";
import {
  getLatestVersion,
  getResource,
  recordContribution,
  updateResource,
} from "@/core/resources/repo";
import { createResourceVersion } from "@/core/versioning/service";
import type {
  DuplicateDecision,
  DuplicateSuggestion,
  Workspace,
} from "@/lib/types";

/**
 * Duplicate suggestions live on the Atlas Feed (type "duplicate_found") with
 * the pair of resource ids in metadata — reviewing one is a feed review.
 */
export async function listOpenDuplicateSuggestions(
  workspace: Workspace,
): Promise<DuplicateSuggestion[]> {
  const items = await listFeedItems(workspace.centre.id, { statuses: ["unread"] });
  const suggestions: DuplicateSuggestion[] = [];

  for (const item of items) {
    if (item.type !== "duplicate_found") continue;
    const meta = item.metadata as {
      newResourceId?: string;
      existingResourceId?: string;
      similarity?: number;
    };
    if (!meta.newResourceId || !meta.existingResourceId) continue;

    const [newResource, existingResource] = await Promise.all([
      getResource(meta.newResourceId),
      getResource(meta.existingResourceId),
    ]);
    // Already resolved elsewhere (e.g. merged during upload review)? Skip quietly.
    if (!newResource || !existingResource) continue;
    if (newResource.status === "merged" || newResource.forkedFrom) continue;

    suggestions.push({
      feedItemId: item.id,
      newResourceId: newResource.id,
      newResourceTitle: newResource.title,
      existingResourceId: existingResource.id,
      existingResourceTitle: existingResource.title,
      similarity: meta.similarity ?? 0,
    });
  }
  return suggestions;
}

/**
 * Resolve a duplicate suggestion.
 *  - merge: the new resource's text is appended to the existing resource as a
 *    new version (nothing overwritten); the new resource is archived as merged.
 *  - fork: both stay, related through forked_from.
 *  - keep_separate: suggestion dismissed, nothing changes.
 */
export async function resolveDuplicate(
  workspace: Workspace,
  input: {
    feedItemId: string | null;
    newResourceId: string;
    existingResourceId: string;
    decision: DuplicateDecision;
  },
): Promise<void> {
  const [newResource, existingResource] = await Promise.all([
    getResource(input.newResourceId),
    getResource(input.existingResourceId),
  ]);
  if (!newResource || !existingResource) throw new Error("Resource not found.");

  if (input.decision === "merge") {
    const [newVersion, existingVersion] = await Promise.all([
      getLatestVersion(newResource.id),
      getLatestVersion(existingResource.id),
    ]);
    const addition = newVersion?.extractedText?.trim();
    const base = existingVersion?.extractedText ?? "";
    const mergedText = addition
      ? `${base.trim()}\n\n---\n\nMerged from “${newResource.title}”:\n\n${addition}`
      : base;

    await createResourceVersion({
      resource: existingResource,
      title: existingResource.title,
      extractedText: mergedText,
      changeNote: `Merged content from “${newResource.title}”`,
      actor: workspace.user,
      createdByAtlas: true,
      reason: "merge",
    });
    await updateResource(newResource.id, {
      status: "merged",
      mergedInto: existingResource.id,
    });
    await recordContribution({
      centreId: workspace.centre.id,
      userId: workspace.user.id,
      userName: workspace.user.fullName,
      resourceId: existingResource.id,
      resourceTitle: existingResource.title,
      eventType: "merged",
      metadata: { mergedResourceId: newResource.id },
    });
  } else if (input.decision === "fork") {
    await updateResource(newResource.id, { forkedFrom: existingResource.id });
    await recordContribution({
      centreId: workspace.centre.id,
      userId: workspace.user.id,
      userName: workspace.user.fullName,
      resourceId: newResource.id,
      resourceTitle: newResource.title,
      eventType: "forked",
      metadata: { forkedFrom: existingResource.id },
    });
  }
  // keep_separate: nothing to change on the resources.

  if (input.feedItemId) {
    const item = await getFeedItem(input.feedItemId);
    if (item) {
      await setFeedItemStatus(
        input.feedItemId,
        input.decision === "keep_separate" ? "dismissed" : "reviewed",
      );
    }
  }
}
