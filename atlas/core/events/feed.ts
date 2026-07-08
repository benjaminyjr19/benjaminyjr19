import type { FeedItem, FeedItemStatus } from "@/lib/types";
import type { AtlasFeedItemRow } from "@/lib/types/database";
import { isDemoMode } from "@/lib/env";
import {
  demoGetFeedItem,
  demoInsertFeedItem,
  demoListFeedItems,
  demoSetFeedItemStatus,
} from "@/lib/demo/store";
import { createServerSupabase } from "@/lib/supabase/server";
import { newId } from "@/lib/utils/ids";

function mapRow(row: AtlasFeedItemRow): FeedItem {
  return {
    id: row.id,
    centreId: row.centre_id,
    type: row.type as FeedItem["type"],
    title: row.title,
    summary: row.summary,
    reviewMinutes: row.review_minutes,
    actionLabel: row.action_label,
    actionHref: row.action_href,
    status: row.status as FeedItemStatus,
    event: (row.event as FeedItem["event"]) ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export interface NewFeedItem {
  centreId: string;
  type: FeedItem["type"];
  title: string;
  summary: string;
  reviewMinutes?: number | null;
  actionLabel?: string | null;
  actionHref?: string | null;
  event?: FeedItem["event"];
  metadata?: Record<string, unknown>;
}

export async function createFeedItem(input: NewFeedItem): Promise<FeedItem> {
  const item: FeedItem = {
    id: newId(),
    centreId: input.centreId,
    type: input.type,
    title: input.title,
    summary: input.summary,
    reviewMinutes: input.reviewMinutes ?? null,
    actionLabel: input.actionLabel ?? null,
    actionHref: input.actionHref ?? null,
    status: "unread",
    event: input.event ?? null,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString(),
  };

  if (isDemoMode()) {
    return demoInsertFeedItem(item);
  }

  const supabase = await createServerSupabase();
  if (!supabase) return item;
  const { error } = await supabase.from("atlas_feed_items").insert({
    id: item.id,
    centre_id: item.centreId,
    type: item.type,
    title: item.title,
    summary: item.summary,
    review_minutes: item.reviewMinutes,
    action_label: item.actionLabel,
    action_href: item.actionHref,
    status: item.status,
    event: item.event,
    metadata: item.metadata,
  });
  if (error) throw new Error(`Failed to create feed item: ${error.message}`);
  return item;
}

export async function listFeedItems(
  centreId: string,
  options?: { statuses?: FeedItemStatus[]; limit?: number },
): Promise<FeedItem[]> {
  if (isDemoMode()) {
    return demoListFeedItems(options);
  }

  const supabase = await createServerSupabase();
  if (!supabase) return [];
  let query = supabase
    .from("atlas_feed_items")
    .select("*")
    .eq("centre_id", centreId)
    .order("created_at", { ascending: false });
  if (options?.statuses) query = query.in("status", options.statuses);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load feed: ${error.message}`);
  return (data as AtlasFeedItemRow[]).map(mapRow);
}

export async function getFeedItem(feedItemId: string): Promise<FeedItem | null> {
  if (isDemoMode()) return demoGetFeedItem(feedItemId);

  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("atlas_feed_items")
    .select("*")
    .eq("id", feedItemId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load feed item: ${error.message}`);
  return data ? mapRow(data as AtlasFeedItemRow) : null;
}

export async function setFeedItemStatus(
  feedItemId: string,
  status: FeedItemStatus,
): Promise<void> {
  if (isDemoMode()) {
    demoSetFeedItemStatus(feedItemId, status);
    return;
  }

  const supabase = await createServerSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from("atlas_feed_items")
    .update({ status })
    .eq("id", feedItemId);
  if (error) throw new Error(`Failed to update feed item: ${error.message}`);
}
