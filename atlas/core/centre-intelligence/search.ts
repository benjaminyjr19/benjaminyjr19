import { listCorpusChunks, listResources } from "@/core/resources/repo";
import type { Resource, ResourceChunk, SearchResult, Workspace } from "@/lib/types";
import { jaccard, keywordSet, snippetAround, tokenize } from "@/lib/utils/text";

/**
 * Universal search across Centre Intelligence.
 *
 * MVP implementation scores titles, tags and stored chunks in-process —
 * deterministic, instant, and identical in preview and connected modes. The
 * schema already carries a tsvector index and a pgvector embedding column;
 * moving this scoring into Postgres FTS + embeddings is the scale path.
 * TODO(post-MVP): push scoring into Postgres (FTS RPC, then pgvector rerank).
 */
export async function searchCentreIntelligence(
  workspace: Workspace,
  query: string,
  options?: { limit?: number },
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const [resources, chunks] = await Promise.all([
    listResources(workspace.centre.id, workspace.user.id),
    listCorpusChunks(workspace.centre.id, workspace.user.id),
  ]);

  const chunksByResource = new Map<string, ResourceChunk[]>();
  for (const chunk of chunks) {
    const list = chunksByResource.get(chunk.resourceId) ?? [];
    list.push(chunk);
    chunksByResource.set(chunk.resourceId, list);
  }

  const queryTokens = tokenize(trimmed);
  const querySet = new Set(queryTokens);
  const queryLower = trimmed.toLowerCase();

  const results: SearchResult[] = [];

  for (const resource of resources) {
    const { score, snippet } = scoreResource(
      resource,
      chunksByResource.get(resource.id) ?? [],
      queryLower,
      querySet,
    );
    if (score < 0.3) continue;
    results.push({
      resourceId: resource.id,
      title: resource.title,
      type: resource.type,
      snippet,
      tags: resource.tags,
      score,
      updatedAt: resource.updatedAt,
    });
  }

  return results
    .sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, options?.limit ?? 20);
}

function scoreResource(
  resource: Resource,
  chunks: ResourceChunk[],
  queryLower: string,
  querySet: Set<string>,
): { score: number; snippet: string } {
  let score = 0;

  const titleLower = resource.title.toLowerCase();
  if (titleLower.includes(queryLower)) score += 3;
  score += jaccard(keywordSet(resource.title), querySet) * 3;

  for (const tag of resource.tags) {
    const tagTokens = keywordSet(tag.name);
    for (const token of querySet) {
      if (tagTokens.has(token)) {
        score += 0.8;
        break;
      }
    }
  }

  // Best-matching chunk drives the snippet.
  let bestChunkScore = 0;
  let bestChunk: ResourceChunk | null = null;
  for (const chunk of chunks) {
    const contentTokens = keywordSet(chunk.content);
    let hits = 0;
    for (const token of querySet) if (contentTokens.has(token)) hits += 1;
    const chunkScore = querySet.size > 0 ? (hits / querySet.size) * 2.2 : 0;
    if (chunkScore > bestChunkScore) {
      bestChunkScore = chunkScore;
      bestChunk = chunk;
    }
  }
  score += bestChunkScore;

  const snippet = bestChunk
    ? snippetAround(bestChunk.content, queryLower)
    : (resource.description ?? "");

  return { score, snippet };
}
