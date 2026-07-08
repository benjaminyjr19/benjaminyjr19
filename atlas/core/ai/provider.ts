import { resolveAIProvider, type AIProviderName } from "@/lib/env";

/**
 * Provider abstraction for Atlas intelligence.
 *
 * Product rules encoded here:
 *  - Providers, models and parameters are internal. Users choose outcomes.
 *  - Every AI service has a deterministic fallback; a provider failure never
 *    breaks a flow, it degrades it gracefully.
 *  - Deterministic code handles what it can (duplicates, tags, feed copy) so
 *    LLM calls are reserved for genuinely generative work.
 */

export interface CompletionRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface AIProvider {
  readonly name: AIProviderName;
  complete(request: CompletionRequest): Promise<string>;
}

export class AIUnavailableError extends Error {
  constructor(message = "No AI provider configured") {
    super(message);
    this.name = "AIUnavailableError";
  }
}

let cached: AIProvider | null | undefined;

/** Returns the configured provider, or null when running deterministically ("mock"). */
export async function getAIProvider(): Promise<AIProvider | null> {
  if (cached !== undefined) return cached;

  const name = resolveAIProvider();
  if (name === "anthropic") {
    const { AnthropicProvider } = await import("./providers/anthropic");
    cached = new AnthropicProvider();
  } else if (name === "openai") {
    const { OpenAIProvider } = await import("./providers/openai");
    cached = new OpenAIProvider();
  } else {
    cached = null;
  }
  return cached;
}
