import { estimateTokens, normalizeWhitespace } from "@/lib/utils/text";

export interface TextChunk {
  index: number;
  content: string;
  tokenEstimate: number;
}

const TARGET_CHARS = 1100;
const OVERLAP_CHARS = 150;

/**
 * Paragraph-aware chunking sized for retrieval. Chunks are stored in
 * `resource_chunks` with a pgvector-ready `embedding` column — embeddings are
 * a post-MVP step; keyword/full-text search runs over these chunks today.
 */
export function chunkText(rawText: string): TextChunk[] {
  const text = normalizeWhitespace(rawText);
  if (!text) return [];

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > TARGET_CHARS && current) {
      chunks.push(current);
      // Carry a small overlap so ideas split across chunks stay findable.
      current = `${current.slice(-OVERLAP_CHARS)}\n\n${paragraph}`;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current);

  // Hard-split any single paragraph that exceeds the target on its own.
  const sized = chunks.flatMap((chunk) => {
    if (chunk.length <= TARGET_CHARS * 1.5) return [chunk];
    const parts: string[] = [];
    for (let i = 0; i < chunk.length; i += TARGET_CHARS) {
      parts.push(chunk.slice(Math.max(0, i - OVERLAP_CHARS), i + TARGET_CHARS));
    }
    return parts;
  });

  return sized.map((content, index) => ({
    index,
    content: content.trim(),
    tokenEstimate: estimateTokens(content),
  }));
}
