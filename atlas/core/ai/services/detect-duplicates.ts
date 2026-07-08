import { DUPLICATE_THRESHOLD, similarityScore } from "@/core/duplicates/similarity";

export interface DuplicateCandidate {
  resourceId: string;
  title: string;
  text: string;
}

export interface DuplicateMatch {
  resourceId: string;
  title: string;
  similarity: number;
}

/**
 * detectDuplicates — fully deterministic on purpose.
 * Similarity is a text-overlap problem; an LLM would be slower, costlier and
 * less predictable. See core/duplicates/similarity.ts for the scoring.
 */
export function detectDuplicates(
  candidate: { title: string; text: string },
  corpus: DuplicateCandidate[],
): DuplicateMatch[] {
  return corpus
    .map((existing) => ({
      resourceId: existing.resourceId,
      title: existing.title,
      similarity: similarityScore(candidate, existing),
    }))
    .filter((m) => m.similarity >= DUPLICATE_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 2);
}
