/**
 * Central environment detection.
 *
 * Atlas runs in two modes:
 *  - Connected  — Supabase env vars present: real auth, Postgres, storage.
 *  - Preview    — no Supabase configured: in-memory demo workspace so the
 *                 product can be explored end-to-end without any keys.
 */

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isDemoMode(): boolean {
  return !isSupabaseConfigured();
}

export type AIProviderName = "anthropic" | "openai" | "mock";

/**
 * Resolve which intelligence provider Atlas uses internally.
 * Never surfaced to users — they choose outcomes, not models.
 */
export function resolveAIProvider(): AIProviderName {
  const configured = process.env.AI_PROVIDER?.toLowerCase().trim();
  if (configured === "anthropic" || configured === "openai" || configured === "mock") {
    return configured;
  }
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}

/** True when a real LLM is available (used for settings status copy only). */
export function isAIConnected(): boolean {
  return resolveAIProvider() !== "mock";
}
