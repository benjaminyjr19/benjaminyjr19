import { z } from "zod";

import { completeJSON } from "@/core/ai/client";
import { classifyResourcePrompt } from "@/prompts/classify-resource";
import type { ResourceType } from "@/lib/types";
import { RESOURCE_TYPES } from "@/lib/types";

export interface Classification {
  type: ResourceType;
  confidence: number;
  reason: string;
}

const classificationSchema = z.object({
  type: z.enum(RESOURCE_TYPES),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

/** Cheap signal table checked before any LLM call. */
const HEURISTICS: Array<{ type: ResourceType; patterns: RegExp; weight: number }> = [
  { type: "curriculum", patterns: /curriculum|framework|learning outcomes|nel |syllabus/i, weight: 0.9 },
  { type: "lesson_template", patterns: /lesson plan template|plan template|planning format|weekly lesson plan\b/i, weight: 0.9 },
  { type: "observation_template", patterns: /observation (record|template|form)|anecdotal record/i, weight: 0.95 },
  { type: "policy", patterns: /policy|policies|procedure|guideline|consent|safety rules/i, weight: 0.85 },
  { type: "newsletter", patterns: /newsletter|dear (families|parents)|term \d (update|news)/i, weight: 0.9 },
  { type: "resource_list", patterns: /materials list|supply list|inventory|shopping list|equipment list/i, weight: 0.85 },
  { type: "weekly_plan", patterns: /week of \d|weekly plan for|week \d+ plan/i, weight: 0.75 },
  { type: "activity", patterns: /activity|activities|game|craft|sensory|\bplay\b|experiment|station/i, weight: 0.7 },
];

export function classifyHeuristically(input: {
  title: string;
  filename: string | null;
  text: string;
}): Classification {
  const haystack = `${input.title}\n${input.filename ?? ""}\n${input.text.slice(0, 2000)}`;
  let best: Classification = {
    type: "other",
    confidence: 0.3,
    reason: "No strong signals — filed as a general document.",
  };
  for (const rule of HEURISTICS) {
    if (rule.patterns.test(haystack) && rule.weight > best.confidence) {
      best = {
        type: rule.type,
        confidence: rule.weight,
        reason: `Matched ${rule.type.replace(/_/g, " ")} signals in the title or content.`,
      };
    }
  }
  if (!input.text && best.confidence < 0.6) {
    best.reason = "Classified from the filename — the file format isn't text-extractable yet.";
  }
  return best;
}

/**
 * classifyResource — heuristics first, LLM only when genuinely uncertain.
 * This keeps classification instant and free for the common cases and spends
 * an AI call only where it changes the outcome.
 */
export async function classifyResource(input: {
  title: string;
  filename: string | null;
  text: string;
}): Promise<Classification> {
  const heuristic = classifyHeuristically(input);
  if (heuristic.confidence >= 0.75) return heuristic;

  const { system, prompt } = classifyResourcePrompt(input);
  const result = await completeJSON({
    system,
    prompt,
    schema: classificationSchema,
    maxTokens: 300,
  });
  return result ?? heuristic;
}
