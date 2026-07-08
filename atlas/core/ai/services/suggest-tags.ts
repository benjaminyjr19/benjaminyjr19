import { z } from "zod";

import { completeJSON } from "@/core/ai/client";
import { suggestTagsPrompt } from "@/prompts/classify-resource";
import { tokenize } from "@/lib/utils/text";

const tagsSchema = z.object({ tags: z.array(z.string().min(1).max(40)).max(6) });

/** Early-childhood domain lexicon → canonical tag names. */
const DOMAIN_LEXICON: Array<{ tag: string; patterns: RegExp }> = [
  { tag: "Language & Literacy", patterns: /literacy|phonics|story|stories|reading|writing|letters|vocabulary|retell/i },
  { tag: "Numeracy", patterns: /numeracy|counting|numbers|pattern|measure|maths|math\b|sort/i },
  { tag: "Motor Skills", patterns: /motor|movement|balance|climb|pouring|threading|cutting|scissor|physical/i },
  { tag: "Discovery of the World", patterns: /science|nature|plant|weather|animal|experiment|observe|grow|seed|water cycle/i },
  { tag: "Social & Emotional", patterns: /social|emotion|feelings|turn-taking|sharing|friendship|empathy/i },
  { tag: "Aesthetics & Creative Expression", patterns: /art|craft|music|paint|drama|puppet|dance|creative|rhythm/i },
  { tag: "Sensory", patterns: /sensory|texture|touch|smell|playdough|sand|water play/i },
  { tag: "Outdoor", patterns: /outdoor|garden|playground|sun safety|excursion/i },
  { tag: "Nature", patterns: /nature|plant|garden|minibeast|insect|leaf|leaves|soil/i },
  { tag: "Template", patterns: /template|format|form\b/i },
  { tag: "Policy", patterns: /policy|procedure|guideline/i },
];

const AGE_GROUP_PATTERNS: Array<{ tag: string; patterns: RegExp }> = [
  { tag: "N1", patterns: /\bn1\b|nursery 1|18 months|2 year/i },
  { tag: "N2", patterns: /\bn2\b|nursery 2|3 year|3 to 4/i },
  { tag: "K1", patterns: /\bk1\b|kindergarten 1|4 year|4 to 5/i },
  { tag: "K2", patterns: /\bk2\b|kindergarten 2|5 year|5 to 6/i },
];

export function suggestTagsHeuristically(input: { title: string; text: string }): string[] {
  const haystack = `${input.title}\n${input.text.slice(0, 3000)}`;
  const tags: string[] = [];

  for (const { tag, patterns } of DOMAIN_LEXICON) {
    if (patterns.test(haystack)) tags.push(tag);
    if (tags.length >= 4) break;
  }
  for (const { tag, patterns } of AGE_GROUP_PATTERNS) {
    if (patterns.test(haystack)) tags.push(tag);
  }

  if (tags.length === 0) {
    // Fall back to the most frequent meaningful words in the title.
    const counts = new Map<string, number>();
    for (const token of tokenize(input.title)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
    tags.push(...top.map(([word]) => word[0].toUpperCase() + word.slice(1)));
  }
  return [...new Set(tags)].slice(0, 5);
}

/**
 * suggestTags — lexicon heuristics cover the common vocabulary of preschool
 * material instantly; the LLM is consulted only for long documents where the
 * lexicon found little.
 */
export async function suggestTags(input: {
  title: string;
  text: string;
  existingTags: string[];
}): Promise<string[]> {
  const heuristic = suggestTagsHeuristically(input);
  if (heuristic.length >= 2 || input.text.length < 400) return heuristic;

  const { system, prompt } = suggestTagsPrompt(input);
  const result = await completeJSON({ system, prompt, schema: tagsSchema, maxTokens: 200 });
  if (!result) return heuristic;
  return [...new Set([...result.tags, ...heuristic])].slice(0, 5);
}
