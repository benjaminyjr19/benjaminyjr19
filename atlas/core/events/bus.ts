import { handleAtlasEvent } from "./handlers";
import type { AtlasEvent } from "./types";

/**
 * Minimal in-process event dispatch. Events describe what Atlas noticed or
 * did; handlers project them onto the Atlas Feed so the product feels like it
 * works in the background.
 *
 * TODO(post-MVP): move to a durable queue (Supabase queues / pg cron) so
 * parsing, classification and plan generation run truly out-of-band.
 */
export async function emitAtlasEvent(event: AtlasEvent): Promise<void> {
  try {
    await handleAtlasEvent(event);
  } catch (error) {
    // Feed projection must never break the user's action.
    console.error(`[atlas:events] handler failed for ${event.name}`, error);
  }
}
