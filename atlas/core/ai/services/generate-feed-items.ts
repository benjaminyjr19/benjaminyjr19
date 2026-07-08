import type { NewFeedItem } from "@/core/events/feed";
import type { AtlasEvent } from "@/core/events/types";
import { RESOURCE_TYPE_LABELS } from "@/lib/types";
import { formatWeekRange } from "@/lib/utils/dates";
import { pluralize } from "@/lib/utils/text";

/**
 * generateFeedItems — turns Atlas events into calm, human feed copy.
 *
 * Deliberately deterministic: feed copy is templated, instant and free.
 * An LLM adds nothing here that a good template doesn't.
 * TODO(post-MVP): a daily LLM pass that condenses many small events into a
 * single morning-briefing paragraph (see prompts/source-summary.ts pattern).
 */
export function generateFeedItems(event: AtlasEvent): NewFeedItem[] {
  const { centreId } = event;

  switch (event.name) {
    case "resource_parsed": {
      const p = event.payload;
      const typeLabel = RESOURCE_TYPE_LABELS[p.type].toLowerCase();
      const tagNote =
        p.tagNames.length > 0 ? ` and tagged it ${listOut(p.tagNames.slice(0, 3))}` : "";
      const textNote = p.hasExtractedText
        ? ""
        : " The original file is stored safely; full text extraction for this format is coming.";
      return [
        {
          centreId,
          type: "resources_added",
          title: `“${p.title}” added to Centre Intelligence`,
          summary: `Atlas read it, filed it as a ${typeLabel}${tagNote}.${textNote}`,
          reviewMinutes: 1,
          actionLabel: "Open resource",
          actionHref: `/centre/${p.resourceId}`,
          event: "resource_parsed",
          metadata: { resourceId: p.resourceId },
        },
      ];
    }

    case "duplicate_detected": {
      const p = event.payload;
      return [
        {
          centreId,
          type: "duplicate_found",
          title: `“${p.newResourceTitle}” looks similar to an existing resource`,
          summary: `It overlaps with “${p.existingResourceTitle}”. You can merge them, keep both as a fork, or keep them separate.`,
          reviewMinutes: 2,
          actionLabel: "Compare",
          actionHref: `/review`,
          event: "duplicate_detected",
          metadata: {
            newResourceId: p.newResourceId,
            existingResourceId: p.existingResourceId,
            similarity: p.similarity,
          },
        },
      ];
    }

    case "weekly_plan_generated": {
      const p = event.payload;
      const range = formatWeekRange(p.weekStart, p.weekEnd);
      const degradedNote = p.degraded
        ? " Atlas drafted it from your templates — review it a little more closely than usual."
        : "";
      const items: NewFeedItem[] = [
        {
          centreId,
          type: "week_ready",
          title: `Week of ${range} is ready`,
          summary: `Atlas prepared “${p.theme}” for ${p.ageGroup} using ${p.sourceCount} ${pluralize(p.sourceCount, "centre resource")}.${degradedNote}`,
          reviewMinutes: 6,
          actionLabel: "Review the week",
          actionHref: `/week/${p.planId}`,
          event: "weekly_plan_generated",
          metadata: { planId: p.planId },
        },
      ];
      if (p.materialsCount > 0) {
        items.push({
          centreId,
          type: "materials_ready",
          title: "Materials checklist prepared",
          summary: `${p.materialsCount} ${pluralize(p.materialsCount, "item")} for the week — ${
            p.materialsToPrepare > 0
              ? `${p.materialsToPrepare} need preparing ahead.`
              : "everything looks ready."
          }`,
          reviewMinutes: 2,
          actionLabel: "Check materials",
          actionHref: `/week/${p.planId}#materials`,
          event: "weekly_plan_generated",
          metadata: { planId: p.planId },
        });
      }
      if (p.observationCount > 0) {
        items.push({
          centreId,
          type: "observations_ready",
          title: `${p.observationCount} observation ${pluralize(p.observationCount, "opportunity", "opportunities")} found`,
          summary:
            "Moments this week suit focused observations — each comes with a suggested lens.",
          reviewMinutes: 2,
          actionLabel: "See opportunities",
          actionHref: `/week/${p.planId}#observations`,
          event: "weekly_plan_generated",
          metadata: { planId: p.planId },
        });
      }
      return items;
    }

    case "teacher_contributed_resource": {
      const p = event.payload;
      const who = event.actor?.fullName ?? "A teacher";
      return [
        {
          centreId,
          type: "contribution",
          title: `${who} contributed “${p.title}”`,
          summary:
            "It's now part of Centre Intelligence — classified, tagged and searchable for everyone.",
          reviewMinutes: 1,
          actionLabel: "Open resource",
          actionHref: `/centre/${p.resourceId}`,
          event: "teacher_contributed_resource",
          metadata: { resourceId: p.resourceId },
        },
      ];
    }

    case "resource_version_created": {
      const p = event.payload;
      if (p.reason !== "merge") return []; // teacher's own edits don't need feed noise
      return [
        {
          centreId,
          type: "version_created",
          title: `“${p.title}” updated with merged content`,
          summary: `Atlas combined the similar resources into version ${p.versionNumber}. Earlier versions are kept — nothing is overwritten.`,
          reviewMinutes: 1,
          actionLabel: "See versions",
          actionHref: `/centre/${p.resourceId}`,
          event: "resource_version_created",
          metadata: { resourceId: p.resourceId },
        },
      ];
    }

    // The teacher is present for these actions — no feed noise.
    case "resource_uploaded":
    case "weekly_plan_updated":
    case "section_regenerated":
    case "feed_item_created":
      return [];
  }
}

function listOut(items: string[]): string {
  if (items.length === 1) return `“${items[0]}”`;
  if (items.length === 2) return `“${items[0]}” and “${items[1]}”`;
  return `“${items[0]}”, “${items[1]}” and “${items[2]}”`;
}
