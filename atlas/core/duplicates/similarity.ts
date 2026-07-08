import { jaccard, keywordSet, shingles } from "@/lib/utils/text";

/**
 * Deterministic near-duplicate scoring — no LLM involved, by design.
 * Title keyword overlap + content shingle overlap, weighted toward content
 * when both documents have text.
 *
 * TODO(post-MVP): add an embedding pass over `resource_chunks.embedding`
 * (pgvector) for semantic near-duplicates that share no vocabulary.
 */
export function similarityScore(
  a: { title: string; text: string },
  b: { title: string; text: string },
): number {
  const titleScore = jaccard(keywordSet(a.title), keywordSet(b.title));

  const hasText = a.text.length > 40 && b.text.length > 40;
  if (!hasText) return titleScore;

  const contentScore = jaccard(shingles(a.text), shingles(b.text));
  // Shingle Jaccard is strict; keyword overlap softens it for paraphrases.
  const keywordScore = jaccard(keywordSet(a.text), keywordSet(b.text));

  return 0.35 * titleScore + 0.4 * keywordScore + 0.25 * contentScore;
}

export const DUPLICATE_THRESHOLD = 0.32;
