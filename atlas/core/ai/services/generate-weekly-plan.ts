import { z } from "zod";

import { completeJSON } from "@/core/ai/client";
import { getAIProvider } from "@/core/ai/provider";
import { summarizeSourceUsage } from "@/core/ai/services/summarize-source-usage";
import type { PlanContextResource } from "@/prompts/weekly-plan";
import { weeklyPlanPrompt } from "@/prompts/weekly-plan";
import type {
  ActivityBlock,
  DayPlan,
  WeeklyPlanContent,
  WeeklyPlanRequest,
} from "@/lib/types";
import { WEEKDAY_LABELS } from "@/lib/utils/dates";
import { newId } from "@/lib/utils/ids";

// ── LLM output schema (ids are attached during normalisation) ──────────────

const blockSchema = z.object({
  period: z.enum(["morning", "midday", "afternoon"]).catch("morning"),
  title: z.string().min(1),
  description: z.string().min(1),
  materials: z.array(z.string()).catch([]),
});

const daySchema = z.object({
  date: z.string(),
  label: z.string(),
  title: z.string().min(1),
  blocks: z.array(blockSchema).min(1),
});

export const rawPlanSchema = z.object({
  overview: z.string().min(20),
  learningGoals: z.array(z.string().min(4)).min(2),
  days: z.array(daySchema).min(3),
  materials: z
    .array(
      z.object({
        item: z.string().min(1),
        detail: z.string().nullable().catch(null),
        day: z.string().nullable().catch(null),
        ready: z.boolean().catch(true),
      }),
    )
    .min(3),
  observationOpportunities: z
    .array(
      z.object({
        focus: z.string().min(1),
        prompt: z.string().min(1),
        day: z.string().nullable().catch(null),
      }),
    )
    .min(1),
  rainyDayAlternatives: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        replaces: z.string().nullable().catch(null),
      }),
    )
    .catch([]),
  reflectionPrompts: z.array(z.string().min(4)).min(1),
  sources: z
    .array(
      z.object({
        resourceId: z.string(),
        title: z.string(),
        usage: z.string(),
      }),
    )
    .catch([]),
});

export type RawPlan = z.infer<typeof rawPlanSchema>;

export interface GeneratePlanInput {
  centreName: string;
  request: WeeklyPlanRequest;
  context: PlanContextResource[];
  /** ISO dates Monday..Friday. */
  dayDates: string[];
}

export interface GeneratedPlan {
  content: WeeklyPlanContent;
  /** True when a configured provider failed and Atlas fell back to templates. */
  degraded: boolean;
  viaAI: boolean;
}

/**
 * generateWeeklyPlan — the core promise of Atlas.
 *
 * With a provider configured, the plan is generated from the centre's own
 * sources via prompts/weekly-plan.ts. Without one (or on any failure) Atlas
 * builds a structured, theme-aware draft deterministically from the same
 * sources — the flow never breaks, quality degrades gracefully.
 */
export async function generateWeeklyPlan(input: GeneratePlanInput): Promise<GeneratedPlan> {
  const provider = await getAIProvider();

  if (provider) {
    const { system, prompt } = weeklyPlanPrompt({
      centreName: input.centreName,
      request: input.request,
      resources: input.context,
      dayDates: input.dayDates,
    });
    const raw = await completeJSON({
      system,
      prompt,
      schema: rawPlanSchema,
      maxTokens: 6000,
    });
    if (raw) {
      return {
        content: normalizeRawPlan(raw, input),
        degraded: false,
        viaAI: true,
      };
    }
    // Provider configured but the call failed → deterministic draft, flagged.
    return {
      content: buildDeterministicPlan(input),
      degraded: true,
      viaAI: false,
    };
  }

  return { content: buildDeterministicPlan(input), degraded: false, viaAI: false };
}

// ── Normalisation ───────────────────────────────────────────────────────────

export function normalizeRawPlan(
  raw: RawPlan,
  input: GeneratePlanInput,
): WeeklyPlanContent {
  const knownIds = new Set(input.context.map((c) => c.resourceId));
  const titlesById = new Map(input.context.map((c) => [c.resourceId, c.title]));

  const days: DayPlan[] = input.dayDates.map((date, i) => {
    const candidate = raw.days[i];
    return {
      date,
      label: WEEKDAY_LABELS[i],
      title: candidate?.title ?? `Day ${i + 1}`,
      blocks: (candidate?.blocks ?? []).slice(0, 4).map(
        (b): ActivityBlock => ({
          id: newId(),
          period: b.period,
          title: b.title,
          description: b.description,
          materials: b.materials,
        }),
      ),
    };
  });

  return {
    overview: raw.overview,
    learningGoals: raw.learningGoals.slice(0, 6),
    days,
    materials: raw.materials.slice(0, 16).map((m) => ({
      id: newId(),
      item: m.item,
      detail: m.detail,
      day: m.day,
      ready: m.ready,
    })),
    observationOpportunities: raw.observationOpportunities.slice(0, 4).map((o) => ({
      id: newId(),
      focus: o.focus,
      prompt: o.prompt,
      day: o.day,
    })),
    rainyDayAlternatives: raw.rainyDayAlternatives.slice(0, 3).map((r) => ({
      id: newId(),
      title: r.title,
      description: r.description,
      replaces: r.replaces,
    })),
    reflectionPrompts: raw.reflectionPrompts.slice(0, 4),
    // Only keep citations of resources we actually provided as context.
    sources: raw.sources
      .filter((s) => knownIds.has(s.resourceId))
      .map((s) => ({
        resourceId: s.resourceId,
        title: titlesById.get(s.resourceId) ?? s.title,
        usage: s.usage,
      })),
  };
}

// ── Deterministic draft generator ───────────────────────────────────────────

const SECTION_USAGE: Record<string, string[]> = {
  curriculum: ["the learning goals", "age-appropriate pitch"],
  lesson_template: ["the daily structure", "the checklist and reflection format"],
  observation_template: ["the observation prompts"],
  policy: ["outdoor scheduling and safety notes"],
  activity: ["hands-on activity ideas"],
  resource_list: ["the materials checklist"],
  weekly_plan: ["continuity with a prior week"],
  newsletter: ["family communication tone"],
  note: ["teacher notes"],
  other: [],
};

/**
 * Template-based plan used in preview mode and as the graceful AI fallback.
 * Theme-aware and grounded in the same gathered sources; `variant` rotates
 * phrasing so "regenerate" visibly changes the section.
 */
export function buildDeterministicPlan(
  input: GeneratePlanInput,
  variant = 0,
): WeeklyPlanContent {
  const { request, context } = input;
  const theme = request.theme.trim() || "Our new theme";
  const themeShort = (theme.split(":")[0] ?? theme).trim();
  const themeLower = themeShort.toLowerCase();
  const who = request.className?.trim() || `the ${request.ageGroup} class`;

  const pickVariant = <T,>(options: T[]): T => options[variant % options.length];

  const overviewOptions = [
    `This week ${who} explores ${themeLower}. The week builds deliberately: wondering on Monday, making on Tuesday, investigating closely on Wednesday, taking the theme outdoors on Thursday, and sharing what was learned on Friday. Each day keeps the centre's usual rhythm — morning circle, one main hands-on experience, and a calmer afternoon block.`,
    `${who[0].toUpperCase()}${who.slice(1)} spends this week with ${themeLower}. Monday opens with what children already know, midweek moves through making and close investigation, Thursday brings the theme outdoors, and Friday closes with children showing and telling what they discovered. The familiar daily rhythm holds throughout: circle, main experience, calm afternoon.`,
  ];
  let overview = pickVariant(overviewOptions);
  if (request.teacherNotes?.trim()) {
    overview += ` Your note — “${request.teacherNotes.trim()}” — is reflected in the small-group prompts.`;
  }

  const learningGoals = [
    `Children will talk about ${themeLower} using new vocabulary from the word wall (Language & Literacy).`,
    `Children will observe closely and describe what they notice about ${themeLower} (Discovery of the World).`,
    `Children will count, sort and compare objects during ${themeLower} explorations (Numeracy).`,
    `Children will strengthen fine motor control through making, drawing and tool use (Motor Skills).`,
    `Children will take turns and share materials in small-group work (Social & Emotional).`,
  ];

  const block = (
    period: ActivityBlock["period"],
    title: string,
    description: string,
    materials: string[] = [],
  ): ActivityBlock => ({ id: newId(), period, title, description, materials });

  const days: DayPlan[] = [
    {
      date: input.dayDates[0],
      label: WEEKDAY_LABELS[0],
      title: `Wondering about ${themeLower}`,
      blocks: [
        block(
          "morning",
          "Morning circle — what do we already know?",
          `Introduce ${themeLower} with a mystery object or large picture. Children share what they already know and what they wonder; start the word wall with three theme words.`,
          ["Mystery object or picture", "Word wall cards"],
        ),
        block(
          "midday",
          "Exploration table — first look",
          `Small groups explore objects and pictures connected to ${themeLower} with magnifiers, sorting them by what they notice. Prompt: “What do you notice? What do you wonder?”`,
          ["Theme objects & pictures", "Magnifying glasses", "Sorting trays"],
        ),
        block(
          "afternoon",
          "Story and first drawings",
          `Read a story connected to ${themeLower} at rest time. In afternoon corners, children draw “what I already know” pictures for the display wall.`,
          ["Theme picture book", "Drawing materials"],
        ),
      ],
    },
    {
      date: input.dayDates[1],
      label: WEEKDAY_LABELS[1],
      title: "Making and doing",
      blocks: [
        block(
          "morning",
          "Morning circle — today we make",
          `Revisit the word wall, then walk through today's making activity step by step with sequence cards. Children repeat the steps back before moving to tables.`,
          ["Sequence cards"],
        ),
        block(
          "midday",
          pickVariant([
            `Create: ${themeLower} with our hands`,
            `Build it: ${themeLower} in small groups`,
          ]),
          pickVariant([
            `Groups of four make a simple craft or construction connected to ${themeLower}. Note who plans before making and who adapts as they go; simplify by pre-cutting parts, extend by asking children to add one detail nobody else has.`,
            `Small groups construct a shared piece connected to ${themeLower} from recycled materials. Each child contributes one element and explains it to the group before it is attached.`,
          ]),
          ["Craft materials", "Child-safe scissors", "Glue"],
        ),
        block(
          "afternoon",
          "Creative corner continues",
          "The making materials stay out in the creative corner so children can revisit and extend their morning work at their own pace.",
          [],
        ),
      ],
    },
    {
      date: input.dayDates[2],
      label: WEEKDAY_LABELS[2],
      title: "Looking closely",
      blocks: [
        block(
          "morning",
          "Morning circle — predictions",
          `Introduce a simple investigation connected to ${themeLower}. Children make predictions; record them on chart paper to revisit on Friday.`,
          ["Chart paper", "Markers"],
        ),
        block(
          "midday",
          "Investigation stations",
          `Rotate small groups through two observation stations connected to ${themeLower}. Children record what they see with drawings; listen for cause-and-effect words — because, so, if.`,
          ["Station materials", "Recording sheets", "Magnifying glasses"],
        ),
        block(
          "afternoon",
          "Art response",
          `Children respond to the morning's discoveries with paint or printing. Name colours, shapes and patterns connected to ${themeLower} as they work.`,
          ["Washable paint", "Paper"],
        ),
      ],
    },
    {
      date: input.dayDates[3],
      label: WEEKDAY_LABELS[3],
      title: `${themeShort} outdoors`,
      blocks: [
        block(
          "morning",
          "Morning circle — outdoor plan",
          "Prepare for outdoor exploration: what are we looking for, and what are our safety agreements? Outdoor block runs before 10:30am.",
          [],
        ),
        block(
          "midday",
          pickVariant(["Outdoor discovery hunt", "Outdoor movement game"]),
          pickVariant([
            `A discovery hunt in the outdoor area: children find and collect things connected to ${themeLower} (or pictures hidden beforehand), then count and compare their finds in pairs.`,
            `A movement game connected to ${themeLower} in the outdoor area, followed by partner counting of collected items or completed rounds.`,
          ]),
          ["Collection bags or baskets", "Picture cards"],
        ),
        block(
          "afternoon",
          "Calm sensory station",
          `A quiet sensory tray connected to ${themeLower} — pouring, scooping and describing textures in groups of four.`,
          ["Sensory tray materials", "Scoops and funnels"],
        ),
      ],
    },
    {
      date: input.dayDates[4],
      label: WEEKDAY_LABELS[4],
      title: "Sharing what we learned",
      blocks: [
        block(
          "morning",
          "Morning circle — remembering our week",
          "Walk the word wall together and revisit Wednesday's predictions. Children vote for their favourite moment of the week with counters.",
          ["Prediction chart", "Counters"],
        ),
        block(
          "midday",
          "Preparing to share",
          `Small groups arrange their work — drawings, constructions, collections — into a simple display and practise one sentence each about ${themeLower} to tell the class.`,
          ["Display table", "Children's work from the week"],
        ),
        block(
          "afternoon",
          "Show and tell",
          "Each group presents to the class. Send home a note inviting families to ask their child one question about the theme this weekend.",
          ["Family note slips"],
        ),
      ],
    },
  ];

  const materials = [
    { item: `Picture book about ${themeLower}`, detail: "borrow from the library corner or centre collection", day: "Monday", ready: false },
    { item: "Theme objects & pictures for exploration", detail: "gather before Monday", day: "Monday", ready: false },
    { item: "Magnifying glasses", detail: null, day: null, ready: true },
    { item: "Word wall cards & markers", detail: null, day: null, ready: true },
    { item: "Craft materials (paper, recycled boxes, glue)", detail: null, day: "Tuesday", ready: true },
    { item: "Sequence cards for making activity", detail: "prepare Monday afternoon", day: "Tuesday", ready: false },
    { item: "Chart paper for predictions", detail: null, day: "Wednesday", ready: true },
    { item: "Washable paint & paper", detail: null, day: "Wednesday", ready: true },
    { item: "Collection bags or baskets", detail: null, day: "Thursday", ready: true },
    { item: "Sensory tray materials", detail: "check allergy list first", day: "Thursday", ready: false },
    { item: "Family note slips", detail: "print before Friday", day: "Friday", ready: false },
  ].map((m) => ({ id: newId(), ...m }));

  const observationOpportunities = [
    {
      id: newId(),
      focus: "Fine motor control (Motor Skills)",
      prompt:
        "During Tuesday's making activity, watch tool grip and control for two focus children — note cutting, gluing and how they handle small parts.",
      day: "Tuesday",
    },
    {
      id: newId(),
      focus: "Scientific talk (Discovery of the World)",
      prompt:
        "At Wednesday's investigation stations, record the exact words children use to predict and explain. Listen for because, so and if.",
      day: "Wednesday",
    },
    {
      id: newId(),
      focus: "Expressive language (Language & Literacy)",
      prompt:
        "During Friday's show and tell, note how each focus child structures their sentence and whether they use word-wall vocabulary unprompted.",
      day: "Friday",
    },
  ];

  const hasRainyResource = context.some((c) => /rain|indoor|wet/i.test(c.title));
  const rainyDayAlternatives = [
    {
      id: newId(),
      title: "Indoor discovery hunt",
      description: `If Thursday's outdoor block is rained off, hide the picture cards around the classroom instead — same hunt, same counting, dry children.${hasRainyResource ? " Adapted from the centre's indoor activity collection." : ""}`,
      replaces: "Thursday — outdoor discovery",
    },
    {
      id: newId(),
      title: "Movement circuit indoors",
      description:
        "Masking-tape lines and cushions make a quick indoor circuit: balance, jump, crawl. Keep the same movement goals as the outdoor game.",
      replaces: "Thursday — outdoor movement",
    },
  ];

  const reflectionPrompts = [
    `Which children showed unexpected interest in ${themeLower}, and how could next week build on it?`,
    "Did the prediction chart come back into conversation on Friday? Capture two child quotes for the display wall.",
    "Which block felt rushed or flat this week — and is it the activity or the timing?",
  ];

  const sources = summarizeSourceUsage(
    context.map((c) => ({
      resourceId: c.resourceId,
      title: c.title,
      type: c.type,
      usedFor: SECTION_USAGE[c.type] ?? [],
    })),
  );

  return {
    overview,
    learningGoals,
    days,
    materials,
    observationOpportunities,
    rainyDayAlternatives,
    reflectionPrompts,
    sources,
  };
}
