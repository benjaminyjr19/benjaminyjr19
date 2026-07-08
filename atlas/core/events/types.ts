import type { AtlasEventName, DuplicateDecision, ResourceType, User } from "@/lib/types";

/** Typed payloads for every Atlas event. */
export interface AtlasEventPayloads {
  resource_uploaded: { resourceId: string; title: string };
  resource_parsed: {
    resourceId: string;
    title: string;
    type: ResourceType;
    tagNames: string[];
    hasExtractedText: boolean;
  };
  duplicate_detected: {
    newResourceId: string;
    newResourceTitle: string;
    existingResourceId: string;
    existingResourceTitle: string;
    similarity: number;
  };
  weekly_plan_generated: {
    planId: string;
    theme: string;
    ageGroup: string;
    weekStart: string;
    weekEnd: string;
    materialsCount: number;
    materialsToPrepare: number;
    observationCount: number;
    sourceCount: number;
    degraded: boolean;
  };
  weekly_plan_updated: { planId: string; theme: string; changeSummary: string };
  section_regenerated: { planId: string; theme: string; section: string };
  teacher_contributed_resource: { resourceId: string; title: string };
  resource_version_created: {
    resourceId: string;
    title: string;
    versionNumber: number;
    reason: "edit" | "merge" | "restore";
    decision?: DuplicateDecision;
  };
  feed_item_created: { feedItemId: string };
}

/** Discriminated union over event names so handlers narrow on `event.name`. */
export type AtlasEvent = {
  [K in AtlasEventName]: {
    name: K;
    centreId: string;
    actor: User | null;
    payload: AtlasEventPayloads[K];
  };
}[AtlasEventName];
