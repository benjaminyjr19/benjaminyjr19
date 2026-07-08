import { generateFeedItems } from "@/core/ai/services/generate-feed-items";

import { createFeedItem } from "./feed";
import type { AtlasEvent } from "./types";

/**
 * Projects events onto the Atlas Feed. Taste rule: the feed is "what changed
 * while I was away" — Atlas's background work and colleagues' contributions
 * belong here; a teacher's own foreground edits do not.
 */
export async function handleAtlasEvent(event: AtlasEvent): Promise<void> {
  const drafts = generateFeedItems(event);
  for (const draft of drafts) {
    await createFeedItem(draft);
  }
}
