/**
 * Atlas intelligence — the AI service layer.
 *
 * Every function here is a typed service with a deterministic core or
 * fallback. UI components never call providers directly; prompts live in
 * /prompts; provider selection lives in core/ai/provider.ts.
 */

export { classifyResource } from "./services/classify-resource";
export { suggestTags } from "./services/suggest-tags";
export { detectDuplicates } from "./services/detect-duplicates";
export { generateWeeklyPlan } from "./services/generate-weekly-plan";
export { regenerateSection } from "./services/regenerate-section";
export { summarizeSourceUsage } from "./services/summarize-source-usage";
export { generateFeedItems } from "./services/generate-feed-items";
