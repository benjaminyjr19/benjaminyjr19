import { RESOURCE_TYPES } from "@/lib/types";
import { truncate } from "@/lib/utils/text";

/**
 * Prompt builders for resource classification and tag suggestion.
 * Prompts live here — never inside UI components or route handlers.
 */

export function classifyResourcePrompt(input: {
  title: string;
  filename: string | null;
  text: string;
}) {
  return {
    system: `You organise documents for a preschool's shared library. You are precise and conservative: when unsure, prefer "other". Respond with JSON only — no prose.`,
    prompt: `Classify this preschool document into exactly one type from this list:
${RESOURCE_TYPES.join(", ")}

Type meanings: curriculum (frameworks, learning outcome guides), lesson_template (reusable planning formats), observation_template (child observation record formats), policy (rules and procedures), activity (activity ideas and instructions), weekly_plan (a specific week's plan), newsletter (family communications), resource_list (materials/equipment lists), note (short informal notes), other.

Document title: ${input.title}
Filename: ${input.filename ?? "none"}
Content:
"""
${truncate(input.text, 4000) || "(no extractable text — classify from title and filename)"}
"""

Respond with JSON: {"type": "<one of the list>", "confidence": <0..1>, "reason": "<one short sentence>"}`,
  };
}

export function suggestTagsPrompt(input: {
  title: string;
  text: string;
  existingTags: string[];
}) {
  return {
    system: `You tag documents for a preschool's shared library. Prefer the centre's existing tags; add at most two new ones. Respond with JSON only.`,
    prompt: `Suggest 2–5 tags for this preschool document.

Existing centre tags (reuse these exact names when they fit):
${input.existingTags.join(", ") || "(none yet)"}

Document title: ${input.title}
Content:
"""
${truncate(input.text, 3000)}
"""

Respond with JSON: {"tags": ["tag", ...]}`,
  };
}
