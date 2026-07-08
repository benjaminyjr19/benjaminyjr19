import type { PlanSection, WeeklyPlanContent, WeeklyPlanRequest } from "@/lib/types";
import { PLAN_SECTION_LABELS } from "@/lib/types";
import { truncate } from "@/lib/utils/text";

import type { PlanContextResource } from "./weekly-plan";

const SECTION_SHAPES: Record<PlanSection, string> = {
  overview: `{"overview": "3–4 sentence weekly overview"}`,
  learningGoals: `{"learningGoals": ["Children will …", …]}`,
  days: `{"days": [{"date", "label", "title", "blocks": [{"period": "morning|midday|afternoon", "title", "description", "materials": ["…"]}]}]} — keep the same five dates and labels`,
  materials: `{"materials": [{"item", "detail": "string or null", "day": "Monday|…|null", "ready": true|false}]}`,
  observationOpportunities: `{"observationOpportunities": [{"focus", "prompt", "day": "Monday|…|null"}]}`,
  rainyDayAlternatives: `{"rainyDayAlternatives": [{"title", "description", "replaces": "string or null"}]}`,
  reflectionPrompts: `{"reflectionPrompts": ["…", …]}`,
};

export function regenerateSectionPrompt(input: {
  centreName: string;
  request: WeeklyPlanRequest;
  content: WeeklyPlanContent;
  section: PlanSection;
  instruction: string | null;
  resources: PlanContextResource[];
}) {
  const sources = input.resources
    .map((r) => `id=${r.resourceId} · "${r.title}" (${r.type})\n${truncate(r.excerpt, 900)}`)
    .join("\n\n");

  return {
    system: `You are Atlas, the planning intelligence of a preschool work platform. You revise one section of an existing weekly plan without disturbing the rest. Keep the teacher's voice, stay grounded in the centre's sources, and respond with JSON only.`,
    prompt: `The plan below is for "${input.request.theme}" (${input.request.ageGroup}, ${input.request.weekStart} to ${input.request.weekEnd}) at ${input.centreName}.

Current plan (JSON):
${truncate(JSON.stringify(input.content), 6000)}

Centre sources:
${sources || "(none)"}

Rewrite ONLY the "${PLAN_SECTION_LABELS[input.section]}" section.
${input.instruction ? `Teacher's instruction: ${input.instruction}` : "Offer a fresh, improved take — keep what clearly works, change what is generic."}

Stay consistent with the other sections (same theme, same days, same activities where they are referenced).

Respond with JSON exactly: ${SECTION_SHAPES[input.section]}`,
  };
}
