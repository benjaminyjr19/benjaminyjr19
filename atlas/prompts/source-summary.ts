import { truncate } from "@/lib/utils/text";

/**
 * Prompt builder for summarising how sources were used in generated work.
 * The deterministic fallback in core/ai/services/summarize-source-usage.ts is
 * the default; this prompt is the optional LLM-polished path.
 */
export function sourceSummaryPrompt(input: {
  theme: string;
  sources: Array<{ resourceId: string; title: string; excerpt: string }>;
  planOverview: string;
}) {
  const sources = input.sources
    .map((s) => `id=${s.resourceId} · "${s.title}"\n${truncate(s.excerpt, 600)}`)
    .join("\n\n");

  return {
    system: `You explain, in one plain sentence per source, how a preschool weekly plan drew on each centre document. Be specific and honest — if a source was barely used, say so. Respond with JSON only.`,
    prompt: `Weekly plan theme: ${input.theme}
Plan overview: ${input.planOverview}

Sources:
${sources}

Respond with JSON: {"sources": [{"resourceId", "title", "usage": "one sentence"}]}`,
  };
}
