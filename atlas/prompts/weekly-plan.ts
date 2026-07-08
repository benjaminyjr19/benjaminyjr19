import type { WeeklyPlanRequest } from "@/lib/types";
import { WEEKDAY_LABELS } from "@/lib/utils/dates";
import { truncate } from "@/lib/utils/text";

export interface PlanContextResource {
  resourceId: string;
  title: string;
  type: string;
  excerpt: string;
}

/**
 * Prompt builder for weekly plan generation. The plan must be grounded in the
 * centre's own materials — every contextual resource is a citable source.
 */
export function weeklyPlanPrompt(input: {
  centreName: string;
  request: WeeklyPlanRequest;
  resources: PlanContextResource[];
  dayDates: string[]; // ISO dates Monday..Friday
}) {
  const { request } = input;
  const sources = input.resources
    .map(
      (r, i) =>
        `[source ${i + 1}] id=${r.resourceId} · "${r.title}" (${r.type})\n${truncate(r.excerpt, 1500)}`,
    )
    .join("\n\n");

  const daysSpec = input.dayDates
    .map((date, i) => `{"date": "${date}", "label": "${WEEKDAY_LABELS[i]}", ...}`)
    .join(", ");

  return {
    system: `You are Atlas, the planning intelligence of a preschool work platform. You prepare warm, practical weekly plans that an experienced early-childhood teacher would trust. You ground every plan in the centre's own curriculum, templates and resources — provided below as sources. You write in clear, concrete teacher language (British English), never in corporate or AI-speak. Respond with JSON only — no prose outside the JSON.`,
    prompt: `Prepare the upcoming teaching week for ${input.centreName}.

Week: ${request.weekStart} to ${request.weekEnd} (Monday–Friday)
Theme: ${request.theme}
Class / age group: ${request.className ? `${request.className} · ` : ""}${request.ageGroup}
Teacher's notes for the week: ${request.teacherNotes || "(none)"}

Centre sources — use these; cite each one you draw on:
${sources || "(the centre has no readable resources yet — plan from sound early-childhood practice and say so in the sources usage notes)"}

Requirements:
- Follow the centre's lesson-plan structure and policies where the sources describe them.
- 4–6 learning goals phrased "Children will…".
- Five days, each with a short day title and exactly 3 blocks (period: "morning", "midday", "afternoon") with practical descriptions a relief teacher could follow, and per-block materials.
- A consolidated materials checklist (8–14 items); set "ready": false for anything needing advance preparation and mention the preparation in "detail".
- 2–4 observation opportunities, each naming a focus (learning area) and a concrete prompt for what to watch and record.
- 2 rainy-day alternatives that swap for specific outdoor blocks ("replaces" names the day and block).
- 2–3 reflection prompts for the team's Friday meeting.
- "sources": one entry per source you actually used, with resourceId copied exactly and one sentence on how it shaped the plan.

Respond with JSON exactly in this shape:
{
  "overview": "3–4 sentence weekly overview",
  "learningGoals": ["Children will …"],
  "days": [${daysSpec}] where each day is {"date", "label", "title", "blocks": [{"period", "title", "description", "materials": ["…"]}]},
  "materials": [{"item", "detail": "string or null", "day": "Monday|…|null", "ready": true|false}],
  "observationOpportunities": [{"focus", "prompt", "day": "Monday|…|null"}],
  "rainyDayAlternatives": [{"title", "description", "replaces": "string or null"}],
  "reflectionPrompts": ["…"],
  "sources": [{"resourceId", "title", "usage"}]
}`,
  };
}
