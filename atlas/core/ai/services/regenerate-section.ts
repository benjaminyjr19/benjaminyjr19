import { z } from "zod";

import { completeJSON } from "@/core/ai/client";
import { getAIProvider } from "@/core/ai/provider";
import type { PlanContextResource } from "@/prompts/weekly-plan";
import { regenerateSectionPrompt } from "@/prompts/regenerate-section";
import type { PlanSection, WeeklyPlanContent, WeeklyPlanRequest } from "@/lib/types";

import {
  buildDeterministicPlan,
  normalizeRawPlan,
  rawPlanSchema,
  type GeneratePlanInput,
} from "./generate-weekly-plan";

const SECTION_SCHEMAS: Record<PlanSection, z.ZodType<unknown>> = {
  overview: rawPlanSchema.pick({ overview: true }),
  learningGoals: rawPlanSchema.pick({ learningGoals: true }),
  days: rawPlanSchema.pick({ days: true }),
  materials: rawPlanSchema.pick({ materials: true }),
  observationOpportunities: rawPlanSchema.pick({ observationOpportunities: true }),
  rainyDayAlternatives: rawPlanSchema.pick({ rainyDayAlternatives: true }),
  reflectionPrompts: rawPlanSchema.pick({ reflectionPrompts: true }),
};

export interface RegenerateSectionInput {
  centreName: string;
  request: WeeklyPlanRequest;
  content: WeeklyPlanContent;
  section: PlanSection;
  instruction: string | null;
  context: PlanContextResource[];
  dayDates: string[];
  /** Bumps deterministic phrasing so repeated regenerations visibly differ. */
  variant: number;
}

/**
 * regenerateSection — replace one section of a plan, leave the rest untouched.
 * LLM when available, deterministic variation otherwise. Never fails the flow.
 */
export async function regenerateSection(
  input: RegenerateSectionInput,
): Promise<{ content: WeeklyPlanContent; viaAI: boolean }> {
  const provider = await getAIProvider();

  if (provider) {
    const { system, prompt } = regenerateSectionPrompt({
      centreName: input.centreName,
      request: input.request,
      content: input.content,
      section: input.section,
      instruction: input.instruction,
      resources: input.context,
    });
    const result = await completeJSON({
      system,
      prompt,
      schema: SECTION_SCHEMAS[input.section],
      maxTokens: input.section === "days" ? 6000 : 1500,
    });
    if (result) {
      const merged = mergeSection(input, result as Partial<z.infer<typeof rawPlanSchema>>);
      if (merged) return { content: merged, viaAI: true };
    }
  }

  // Deterministic fallback: rebuild the plan at a new variant and lift the section.
  const generateInput: GeneratePlanInput = {
    centreName: input.centreName,
    request: input.request,
    context: input.context,
    dayDates: input.dayDates,
  };
  const rebuilt = buildDeterministicPlan(generateInput, input.variant);
  const content: WeeklyPlanContent = {
    ...input.content,
    [input.section]: rebuilt[input.section],
  };
  return { content, viaAI: false };
}

/** Validate the regenerated fragment by round-tripping it through full-plan normalisation. */
function mergeSection(
  input: RegenerateSectionInput,
  fragment: Partial<z.infer<typeof rawPlanSchema>>,
): WeeklyPlanContent | null {
  const value = fragment[input.section];
  if (value === undefined) return null;

  const draft = {
    overview: input.content.overview,
    learningGoals: input.content.learningGoals,
    days: input.content.days,
    materials: input.content.materials,
    observationOpportunities: input.content.observationOpportunities,
    rainyDayAlternatives: input.content.rainyDayAlternatives,
    reflectionPrompts: input.content.reflectionPrompts,
    sources: input.content.sources,
    [input.section]: value,
  };

  const parsed = rawPlanSchema.safeParse(draft);
  if (!parsed.success) return null;

  const normalized = normalizeRawPlan(parsed.data, {
    centreName: input.centreName,
    request: input.request,
    context: input.context,
    dayDates: input.dayDates,
  });

  // Keep untouched sections exactly as they were (ids, checked state, sources).
  return {
    ...input.content,
    [input.section]: normalized[input.section],
  };
}
