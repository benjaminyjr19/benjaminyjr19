import type { PlanSource } from "@/lib/types";

export interface SourceUsageInput {
  resourceId: string;
  title: string;
  type: string;
  /** Sections of the plan this source informed. */
  usedFor: string[];
}

/**
 * summarizeSourceUsage — builds the "what Atlas used" explanations.
 * Deterministic template; honest and instant. The LLM path (see
 * prompts/source-summary.ts) is reserved for post-MVP polish where generated
 * plans have subtler source relationships.
 */
export function summarizeSourceUsage(sources: SourceUsageInput[]): PlanSource[] {
  return sources.map((source) => {
    const used = source.usedFor.filter(Boolean);
    const usage =
      used.length > 0
        ? `Informed ${formatList(used)}.`
        : `Consulted while preparing the week.`;
    return { resourceId: source.resourceId, title: source.title, usage };
  });
}

function formatList(items: string[]): string {
  const unique = [...new Set(items)];
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`;
}
