"use server";

import { revalidatePath } from "next/cache";

import { setFeedItemStatus } from "@/core/events/feed";
import { requireWorkspace } from "@/core/workspace/service";
import type { FeedItemStatus } from "@/lib/types";

import type { ActionResult } from "./plans";

export async function setFeedStatusAction(
  feedItemId: string,
  status: Extract<FeedItemStatus, "reviewed" | "dismissed">,
): Promise<ActionResult> {
  try {
    await requireWorkspace();
    await setFeedItemStatus(feedItemId, status);
    revalidatePath("/today");
    revalidatePath("/review");
    return { ok: true };
  } catch (error) {
    console.error("[atlas:action]", error);
    return { ok: false, error: "Couldn't update the item." };
  }
}
