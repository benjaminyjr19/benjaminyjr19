import { listCorpusChunks, listResources } from "@/core/resources/repo";
import type { PlanContextResource } from "@/prompts/weekly-plan";
import type { Resource, Workspace } from "@/lib/types";
import { jaccard, keywordSet } from "@/lib/utils/text";

/**
 * Choose which Centre Intelligence resources ground a weekly plan.
 *
 * Deterministic selection: the centre's structural documents (curriculum,
 * lesson template, policies) always anchor the plan; activity-type resources
 * are picked by relevance to the theme. Everything selected becomes a
 * citable source on the finished plan.
 */
export async function gatherPlanContext(
  workspace: Workspace,
  input: { theme: string; ageGroup: string },
): Promise<PlanContextResource[]> {
  const [resources, chunks] = await Promise.all([
    listResources(workspace.centre.id, workspace.user.id),
    listCorpusChunks(workspace.centre.id, workspace.user.id),
  ]);

  const textByResource = new Map<string, string>();
  for (const chunk of chunks) {
    const existing = textByResource.get(chunk.resourceId) ?? "";
    if (existing.length < 4000) {
      textByResource.set(chunk.resourceId, `${existing}\n\n${chunk.content}`.trim());
    }
  }

  const themeSet = keywordSet(`${input.theme} ${input.ageGroup}`);
  const relevance = (r: Resource) =>
    jaccard(keywordSet(`${r.title} ${r.tags.map((t) => t.name).join(" ")}`), themeSet) +
    jaccard(keywordSet((textByResource.get(r.id) ?? "").slice(0, 2000)), themeSet);

  const byType = (type: Resource["type"]) =>
    resources
      .filter((r) => r.type === type && r.status === "ready")
      .sort((a, b) => relevance(b) - relevance(a));

  const picked: Resource[] = [];
  const pushSome = (list: Resource[], count: number) => {
    for (const r of list.slice(0, count)) {
      if (!picked.some((p) => p.id === r.id)) picked.push(r);
    }
  };

  pushSome(byType("curriculum"), 1);
  pushSome(byType("lesson_template"), 1);
  pushSome(byType("observation_template"), 1);
  pushSome(byType("policy"), 1);
  pushSome(byType("resource_list"), 1);
  pushSome(byType("activity"), 2);
  // A prior plan or note that strongly matches the theme is worth carrying in.
  pushSome(
    resources
      .filter((r) => (r.type === "weekly_plan" || r.type === "note") && relevance(r) > 0.08)
      .sort((a, b) => relevance(b) - relevance(a)),
    1,
  );

  return picked.slice(0, 7).map((r) => ({
    resourceId: r.id,
    title: r.title,
    type: r.type,
    excerpt: textByResource.get(r.id) ?? r.description ?? r.title,
  }));
}
