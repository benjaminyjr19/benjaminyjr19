import type { ZodType, ZodTypeDef } from "zod";

import { getAIProvider } from "./provider";

/**
 * Run a completion that must return JSON matching `schema`.
 *
 * Returns `null` when no provider is configured, the call fails, or the
 * output doesn't validate — callers always have a deterministic fallback, so
 * AI failure degrades quality, never availability.
 */
export async function completeJSON<T>(options: {
  system: string;
  prompt: string;
  schema: ZodType<T, ZodTypeDef, unknown>;
  maxTokens?: number;
}): Promise<T | null> {
  const provider = await getAIProvider();
  if (!provider) return null;

  try {
    const raw = await provider.complete({
      system: options.system,
      prompt: options.prompt,
      maxTokens: options.maxTokens,
    });
    const json = extractJSON(raw);
    if (json === null) return null;
    const parsed = options.schema.safeParse(json);
    if (!parsed.success) {
      console.error("[atlas:ai] output failed validation", parsed.error.issues.slice(0, 3));
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.error("[atlas:ai] completion failed", error);
    return null;
  }
}

/** Tolerant JSON extraction: handles code fences and leading/trailing prose. */
function extractJSON(text: string): unknown | null {
  const candidates: string[] = [];

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) candidates.push(fenced[1]);

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    candidates.push(text.slice(firstBracket, lastBracket + 1));
  }
  candidates.push(text.trim());

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next candidate
    }
  }
  return null;
}
