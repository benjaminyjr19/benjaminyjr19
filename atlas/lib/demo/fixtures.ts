/**
 * Seed content for the demo workspace: one sample preschool centre with
 * realistic Centre Intelligence, an upcoming weekly plan prepared by Atlas,
 * and a morning-briefing feed.
 *
 * Mirrors `supabase/seed.sql` — keep the two roughly in sync.
 */

import type {
  Centre,
  ContributionEvent,
  FeedItem,
  PrivateTeacherNote,
  Resource,
  ResourceChunk,
  ResourceVersion,
  Tag,
  User,
  WeeklyPlan,
  WeeklyPlanContent,
  WeeklyPlanVersion,
} from "@/lib/types";
import { addDays, toISODate, upcomingMonday, WEEKDAY_LABELS } from "@/lib/utils/dates";

// Stable ids so links survive reloads.
const id = {
  centre: "c0000000-0000-4000-8000-000000000001",
  sarah: "u0000000-0000-4000-8000-000000000001",
  meilin: "u0000000-0000-4000-8000-000000000002",
  priya: "u0000000-0000-4000-8000-000000000003",
  plan: "p0000000-0000-4000-8000-000000000001",
  planV1: "pv000000-0000-4000-8000-000000000001",
  rCurriculum: "r0000000-0000-4000-8000-000000000001",
  rLessonTemplate: "r0000000-0000-4000-8000-000000000002",
  rObservationTemplate: "r0000000-0000-4000-8000-000000000003",
  rSensoryBank: "r0000000-0000-4000-8000-000000000004",
  rOutdoorPolicy: "r0000000-0000-4000-8000-000000000005",
  rRainyDay: "r0000000-0000-4000-8000-000000000006",
  rNewsletter: "r0000000-0000-4000-8000-000000000007",
  rGardenList: "r0000000-0000-4000-8000-000000000008",
  rShadowPuppet: "r0000000-0000-4000-8000-000000000009",
  rWaterPlay: "r0000000-0000-4000-8000-000000000010",
  fWeekReady: "f0000000-0000-4000-8000-000000000001",
  fMaterials: "f0000000-0000-4000-8000-000000000002",
  fObservations: "f0000000-0000-4000-8000-000000000003",
  fWeather: "f0000000-0000-4000-8000-000000000004",
  fResources: "f0000000-0000-4000-8000-000000000005",
  fDuplicate: "f0000000-0000-4000-8000-000000000006",
} as const;

export const DEMO_IDS = id;

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400_000).toISOString();

const monday = upcomingMonday(now);
const weekStart = toISODate(monday);
const weekEnd = toISODate(addDays(monday, 4));
const dayISO = (offset: number) => toISODate(addDays(monday, offset));

// ── Workspace ───────────────────────────────────────────────────────────────

export const demoCentre: Centre = {
  id: id.centre,
  name: "Sunny Grove Preschool",
  timezone: "Asia/Singapore",
  createdAt: daysAgo(210),
};

export const demoUsers: User[] = [
  { id: id.sarah, email: "sarah@sunnygrove.example", fullName: "Sarah Tan" },
  { id: id.meilin, email: "meilin@sunnygrove.example", fullName: "Mei Lin Chong" },
  { id: id.priya, email: "priya@sunnygrove.example", fullName: "Priya Nair" },
];

export const DEMO_CURRENT_USER_ID = id.sarah;

// ── Tags ────────────────────────────────────────────────────────────────────

const tag = (name: string, kind: Tag["kind"]): Tag => ({
  id: `t-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  centreId: id.centre,
  name,
  kind,
});

export const demoTags: Tag[] = [
  tag("Language & Literacy", "domain"),
  tag("Numeracy", "domain"),
  tag("Motor Skills", "domain"),
  tag("Discovery of the World", "domain"),
  tag("Social & Emotional", "domain"),
  tag("Aesthetics & Creative Expression", "domain"),
  tag("N1", "age_group"),
  tag("N2", "age_group"),
  tag("K1", "age_group"),
  tag("K2", "age_group"),
  tag("Outdoor", "custom"),
  tag("Sensory", "custom"),
  tag("Nature", "custom"),
  tag("Art & Craft", "custom"),
  tag("Template", "format"),
  tag("Policy", "format"),
];

const tagsByName = new Map(demoTags.map((t) => [t.name, t]));
const pick = (...names: string[]): Tag[] =>
  names.map((n) => tagsByName.get(n)).filter((t): t is Tag => Boolean(t));

// ── Resources ───────────────────────────────────────────────────────────────

interface ResourceSeed {
  resource: Resource;
  text: string;
}

const baseResource = (
  partial: Omit<
    Resource,
    | "centreId"
    | "status"
    | "visibility"
    | "filePath"
    | "mimeType"
    | "hasExtractedText"
    | "currentVersion"
    | "forkedFrom"
    | "mergedInto"
    | "description"
    | "contributed"
  > &
    Partial<Resource>,
): Resource => ({
  centreId: id.centre,
  description: null,
  status: "ready",
  visibility: "centre",
  filePath: null,
  mimeType: "text/plain",
  hasExtractedText: true,
  currentVersion: 1,
  contributed: false,
  forkedFrom: null,
  mergedInto: null,
  ...partial,
});

const seeds: ResourceSeed[] = [
  {
    resource: baseResource({
      id: id.rCurriculum,
      title: "NEL Curriculum Guide — Kindergarten 1",
      description:
        "Centre adaptation of Singapore's Nurturing Early Learners framework for K1.",
      type: "curriculum",
      originalFilename: "nel-curriculum-guide-k1.pdf",
      mimeType: "application/pdf",
      createdBy: id.sarah,
      createdByName: "Sarah Tan",
      tags: pick("K1", "Discovery of the World", "Language & Literacy", "Numeracy"),
      createdAt: daysAgo(180),
      updatedAt: daysAgo(30),
    }),
    text: `Sunny Grove adaptation of the Nurturing Early Learners (NEL) framework for Kindergarten 1 (ages 4 to 5).

Learning dispositions we nurture: perseverance, reflectiveness, appreciation, inventiveness, sense of wonder and curiosity, engagement (PRAISE).

Learning areas and K1 outcomes:
Language and Literacy — children speak in simple sentences about familiar experiences, recognise their written name, enjoy shared reading, and begin to retell familiar stories in sequence.
Numeracy — children count reliably to ten, match quantity to numeral, compare sizes and lengths using everyday language, and recognise simple patterns in the environment.
Discovery of the World — children observe living and non-living things closely, describe changes over time (growth, weather, day and night), ask questions about how things work, and care for plants and animals around them.
Motor Skills Development — children develop fundamental movement skills through daily outdoor play, manipulate small objects with increasing control (threading, pouring, cutting along a line).
Social and Emotional Development — children take turns, express feelings in words, and show care for friends and the environment.
Aesthetics and Creative Expression — children experiment with colour, texture and rhythm, and use art, music and movement to express ideas.

Planning guidance: each week should centre on one meaningful theme drawn from children's everyday world. Plan a balance of teacher-guided and child-initiated experiences, daily outdoor time before 10:30am (see Outdoor Play & Sun Safety Policy), and at least two purposeful observation windows per week linked to learning outcomes. Themes should build across the term and revisit prior vocabulary.`,
  },
  {
    resource: baseResource({
      id: id.rLessonTemplate,
      title: "Weekly Lesson Plan Template",
      description: "The centre's standard five-day plan structure.",
      type: "lesson_template",
      originalFilename: "weekly-lesson-plan-template.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      createdBy: id.sarah,
      createdByName: "Sarah Tan",
      tags: pick("Template", "K1", "K2"),
      createdAt: daysAgo(160),
      updatedAt: daysAgo(160),
    }),
    text: `Sunny Grove weekly lesson plan structure.

Each week states: theme, class and age group, weekly overview (3 to 4 sentences a relief teacher could follow), and 4 to 6 learning goals phrased as "Children will…" and mapped to NEL learning areas.

Each day follows the same rhythm:
Morning circle (8:45) — welcome song, calendar and weather chart, introduce the day's key question and two or three theme words.
Main experience (9:15) — one hands-on activity in small groups; note the setup, teacher prompts, and how the activity can be simplified or extended.
Outdoor time (10:00) — free play plus one guided game linked to the theme where natural.
Story and rest (12:30) — book connected to the theme where possible.
Afternoon corners (15:00) — learning corners refreshed midweek; note any corner provocations tied to the theme.

Every plan ends with: a materials checklist grouped by day, two or three observation opportunities with a suggested focus child behaviour, wet-weather alternatives for any outdoor block, and reflection prompts for the team meeting on Friday.`,
  },
  {
    resource: baseResource({
      id: id.rObservationTemplate,
      title: "Observation Record Template",
      description: "Anecdotal observation format used across the centre.",
      type: "observation_template",
      originalFilename: "observation-record-template.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      createdBy: id.meilin,
      createdByName: "Mei Lin Chong",
      tags: pick("Template"),
      createdAt: daysAgo(150),
      updatedAt: daysAgo(150),
    }),
    text: `Anecdotal observation record.

Fields: child's initials, date and time, setting (corner, outdoor, small group), learning area, objective observation (what the child did and said, verbatim where possible), interpretation (what this suggests about the child's learning), and next step (one concrete follow-up experience).

Guidance: observe for two to three minutes before writing. Describe, do not evaluate — "stacked six blocks, adjusted the base twice" rather than "played well". One meaningful observation is worth more than five rushed ones. Link the next step to an upcoming week where possible so it feeds back into planning.`,
  },
  {
    resource: baseResource({
      id: id.rSensoryBank,
      title: "Sensory Play Activity Bank",
      description: "Twelve low-preparation sensory experiences for 3–5 year olds.",
      type: "activity",
      originalFilename: "sensory-play-activity-bank.pdf",
      mimeType: "application/pdf",
      createdBy: id.meilin,
      createdByName: "Mei Lin Chong",
      tags: pick("Sensory", "Motor Skills", "N2", "K1"),
      createdAt: daysAgo(90),
      updatedAt: daysAgo(90),
    }),
    text: `Sensory play activity bank for 3 to 5 year olds. Low preparation, classroom-tested.

1. Rainbow rice trays — dyed rice with scoops, funnels and small pots. Focus: pouring control, colour naming.
2. Water play station — basins with cups, sieves, sponges and floating objects. Focus: sink and float talk, hand strength. Keep towels nearby and rotate four children at a time.
3. Nature texture boards — bark, leaves, seeds and stones glued to boards for describing words.
4. Soil and seed exploration tubs — potting soil, trowels, real seeds to examine with magnifiers before planting.
5. Playdough garden — green dough, silk flowers, pebbles; children build miniature gardens and describe them.
6. Ice rescue — small toys frozen in ice, warm water droppers. Focus: melting talk, patience.
7. Sound bottles — matched pairs filled with rice, beans, water. Focus: listening discrimination.
8. Foam letters wash — soapy trays with foam letters; children fish out letters from their name.
9. Sand writing trays — fine sand for pre-writing strokes with fingers and sticks.
10. Smell pots — pandan, cinnamon, lemon, mint in covered pots with holes.
11. Bubble wrap stomp painting — paint on bubble wrap, stomp on paper rolls outdoors.
12. Mud kitchen — soil, water, old pots and utensils outdoors; add herbs for scent.

Safety notes: taste-safe materials for N1 and N2; check allergy list before smell pots and herb use; wipe floors immediately around water stations.`,
  },
  {
    resource: baseResource({
      id: id.rOutdoorPolicy,
      title: "Outdoor Play & Sun Safety Policy",
      description: "When and how classes use the garden and playground.",
      type: "policy",
      originalFilename: "outdoor-play-sun-safety-policy.pdf",
      mimeType: "application/pdf",
      createdBy: id.sarah,
      createdByName: "Sarah Tan",
      tags: pick("Policy", "Outdoor"),
      createdAt: daysAgo(120),
      updatedAt: daysAgo(45),
    }),
    text: `Outdoor play and sun safety policy.

Every class has daily outdoor time, scheduled before 10:30am to avoid peak heat. Teachers check the NEA weather reading before heading out; if the heat stress reading is high, shorten outdoor time to 20 minutes in shaded areas and bring water bottles.

Sun protection: hats for all children, sunscreen applied by parents before drop-off (spare centre sunscreen requires the signed consent form). Shaded rest point available at all times.

Wet weather: at the first sign of lightning alert or heavy rain, classes move indoors immediately. Every weekly plan must include an indoor alternative for each outdoor block so the day continues without improvisation. Light drizzle with no lightning alert: covered walkway play is permitted with closed shoes.

The garden plot: K1 and K2 classes share the raised beds. Tools are child-sized and counted out and back in. Hand-washing is required after all soil contact.`,
  },
  {
    resource: baseResource({
      id: id.rRainyDay,
      title: "Rainy Day Indoor Activities",
      description: "Quick swaps for outdoor blocks during wet weather.",
      type: "activity",
      originalFilename: "rainy-day-indoor-activities.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      createdBy: id.priya,
      createdByName: "Priya Nair",
      tags: pick("Motor Skills", "N2", "K1", "K2"),
      createdAt: daysAgo(60),
      updatedAt: daysAgo(60),
    }),
    text: `Indoor alternatives for wet-weather days. Each swaps in for an outdoor block with no extra shopping.

Movement: masking-tape balance lines and shapes on the classroom floor; animal walk circuits (bear crawl, frog jump, crab walk); balloon keep-up in pairs; indoor obstacle course with cushions and tunnels.

Calm energy: rain-listening minute at the window with eyes closed, then describing words on the board; "rain painting" — watercolour on paper held briefly under the covered walkway drip line; weather chart update and thunderstorm counting game (count seconds between flash and rumble from safety).

Theme-friendly: indoor planting station with pots on trays; watering-can relay with sponges instead of water; garden yoga (grow from seed to tree); vegetable printing with paint.

Keep the same learning goal as the replaced outdoor block where possible — the swap is of setting, not of intent.`,
  },
  {
    resource: baseResource({
      id: id.rNewsletter,
      title: "Term 3 Newsletter — Growing Together",
      description: "Sent to families in week 1 of term 3.",
      type: "newsletter",
      originalFilename: "term-3-newsletter.pdf",
      mimeType: "application/pdf",
      createdBy: id.sarah,
      createdByName: "Sarah Tan",
      tags: pick("K1", "Nature"),
      createdAt: daysAgo(21),
      updatedAt: daysAgo(21),
    }),
    text: `Term 3 newsletter — Growing Together.

Dear families, this term our K1 and K2 classes become gardeners. Across the next eight weeks children will plant, measure, observe and harvest in our garden plot, connecting daily experiences to how living things grow and change.

Highlights this term: seed-planting week with take-home seedlings; a visit from a community gardener; harvest cooking morning in week 8. Please send a labelled hat every day and a change of clothes for soil and water play.

Ways to help at home: let your child water a plant and describe what changed; point out fruit and vegetables at the market and name their parts — root, stem, leaf, fruit, seed.`,
  },
  {
    resource: baseResource({
      id: id.rGardenList,
      title: "Little Gardeners Materials List",
      description: "Consumables and equipment for the gardening theme weeks.",
      type: "resource_list",
      originalFilename: "little-gardeners-materials-list.xlsx",
      mimeType: "text/plain",
      createdBy: id.priya,
      createdByName: "Priya Nair",
      tags: pick("Nature", "K1"),
      createdAt: daysAgo(14),
      updatedAt: daysAgo(14),
    }),
    text: `Little Gardeners materials list.

In the store room: child trowels (12), watering cans (6), magnifying glasses (10), seed trays (8), plant markers (30), garden gloves child size (24), measuring tape ribbons (12), clipboards (12).

To purchase or request each run: potting soil (2 bags), bean seeds and marigold seeds (fast, reliable germination), egg cartons for seed starting, chart paper for growth charts, washable brown and green paint.

Parent donation candidates: clean yogurt cups for transplanting, old spoons for the mud kitchen, unwanted saucers for under pots.

Preparation notes: soak bean seeds the night before planting day; pre-fill seed trays for N classes, K classes fill their own; label watering cans by group colour to avoid queue disputes.`,
  },
  {
    resource: baseResource({
      id: id.rShadowPuppet,
      title: "Shadow Puppet Theatre",
      description: "Contributed activity — light, shadow and storytelling.",
      type: "activity",
      originalFilename: null,
      mimeType: "text/plain",
      createdBy: id.meilin,
      createdByName: "Mei Lin Chong",
      contributed: true,
      tags: pick("Aesthetics & Creative Expression", "Language & Literacy", "K1", "K2"),
      createdAt: hoursAgo(26),
      updatedAt: hoursAgo(26),
    }),
    text: `Shadow puppet theatre. Contributed after our K2 class ran it during the light-and-dark week — it worked beautifully with mixed abilities.

Setup: white bedsheet across two chairs, lamp or torch behind, room dimmed. Children cut simple animal and plant silhouettes from black card taped to satay sticks (pre-cut for younger groups).

Run it: small groups of four behind the screen while the class watches. Start with "guess the shadow", then let each group retell a familiar story or invent a short one. Rotate every five minutes.

Why it works: quiet children speak more readily from behind the screen; big-shadow/small-shadow play sneaks in early science (move the puppet closer to the light and watch it grow); and retelling supports story sequencing.

Extension: shadow hunt outdoors in morning light — trace a friend's shadow with chalk, return after outdoor play and discuss why it moved.`,
  },
  {
    resource: baseResource({
      id: id.rWaterPlay,
      title: "Water Play Stations",
      description: null,
      type: "activity",
      originalFilename: "water-play-stations.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      createdBy: id.priya,
      createdByName: "Priya Nair",
      tags: pick("Sensory", "Motor Skills", "N2"),
      createdAt: hoursAgo(15),
      updatedAt: hoursAgo(15),
    }),
    text: `Water play stations for the classroom.

Set up basins with cups, sieves, sponges, funnels and floating objects. Children rotate in groups of four. Talk about which objects sink and which float, and why. Builds hand strength through squeezing sponges and pouring between containers.

Keep towels nearby, wipe spills immediately, and rotate children every ten minutes. Works well indoors on wet-weather days as a sensory alternative to outdoor water play.`,
  },
];

export const demoResources: Resource[] = seeds.map((s) => s.resource);

export const demoResourceVersions: ResourceVersion[] = seeds.map((s) => ({
  id: `v-${s.resource.id}`,
  resourceId: s.resource.id,
  versionNumber: 1,
  title: s.resource.title,
  extractedText: s.text,
  changeNote: null,
  createdBy: s.resource.createdBy,
  createdByName: s.resource.createdByName,
  createdByAtlas: false,
  createdAt: s.resource.createdAt,
}));

/** Chunks are derived from version text at store init (see store.ts). */
export const demoChunkSource: Array<{ resourceId: string; versionId: string; text: string }> =
  demoResourceVersions.map((v) => ({
    resourceId: v.resourceId,
    versionId: v.id,
    text: v.extractedText,
  }));

// ── Weekly plan ─────────────────────────────────────────────────────────────

const block = (
  period: "morning" | "midday" | "afternoon",
  title: string,
  description: string,
  materials: string[] = [],
) => ({ id: `b-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`, period, title, description, materials });

export const demoPlanContent: WeeklyPlanContent = {
  overview:
    "This week the K1 Sunbeams become gardeners. Children plant bean and marigold seeds, learn the parts of a plant, and set up a growth chart they will return to all term. The week moves from wondering (what is inside a seed?) to doing (planting, watering) to noticing (first observations and measurements). Outdoor blocks use the garden plot before 10:30am in line with the sun safety policy.",
  learningGoals: [
    "Children will name the basic parts of a plant — root, stem, leaf, flower, seed (Discovery of the World).",
    "Children will describe what seeds need to grow using words like soil, water, sunlight (Discovery of the World).",
    "Children will count and compare seeds and seedlings up to ten (Numeracy).",
    "Children will strengthen fine motor control through planting, pouring and tool use (Motor Skills).",
    "Children will take turns caring for a shared class garden (Social & Emotional).",
  ],
  days: [
    {
      date: dayISO(0),
      label: WEEKDAY_LABELS[0],
      title: "What is a seed?",
      blocks: [
        block(
          "morning",
          "Morning circle — the mystery bag",
          "Pass a cloth bag of mixed seeds around the circle. Children feel and guess before looking. Introduce the week's key question: what is hiding inside a seed? Add 'seed', 'plant' and 'grow' to the word wall.",
          ["Mixed seeds in cloth bag", "Word wall cards"],
        ),
        block(
          "midday",
          "Seed exploration tubs",
          "Small groups examine bean seeds, marigold seeds and a coconut with magnifiers. Sort by size and colour into egg cartons. Prompt: which seed do you think grows the biggest plant?",
          ["Magnifying glasses", "Egg cartons", "Bean & marigold seeds"],
        ),
        block(
          "afternoon",
          "Story & seed dance",
          "Read a growing story at rest time. Afternoon garden yoga: curl up as seeds, grow slowly into tall trees as the teacher 'waters' the class.",
          ["Growing-themed picture book"],
        ),
      ],
    },
    {
      date: dayISO(1),
      label: WEEKDAY_LABELS[1],
      title: "Planting day",
      blocks: [
        block(
          "morning",
          "Morning circle — how to plant",
          "Demonstrate planting one bean step by step; children instruct the teacher and catch her 'mistakes' (seed on top of soil, no water). Sequence cards on the board: soil, seed, cover, water, sun.",
          ["Sequence cards", "Demo pot"],
        ),
        block(
          "midday",
          "Planting in the garden plot",
          "Groups of four at the raised beds plant soaked bean seeds; each child also plants one seed in a labelled cup for the windowsill. Count seeds aloud as they go. Wash hands after soil contact.",
          ["Soaked bean seeds", "Potting soil", "Trowels", "Labelled cups", "Watering cans"],
        ),
        block(
          "afternoon",
          "Playdough garden corner",
          "Green dough, silk flowers and pebbles in the creative corner — children build miniature gardens and describe them to a friend.",
          ["Green playdough", "Silk flowers", "Pebbles"],
        ),
      ],
    },
    {
      date: dayISO(2),
      label: WEEKDAY_LABELS[2],
      title: "Roots, stems and leaves",
      blocks: [
        block(
          "morning",
          "Morning circle — parts of a plant",
          "Reveal a real spring onion with roots. Name each part; children point to their own 'roots' (feet), 'stem' (body), 'leaves' (arms) in the plant song.",
          ["Spring onion with roots", "Plant parts poster"],
        ),
        block(
          "midday",
          "Celery colour experiment",
          "Stand celery stalks in coloured water. Predict together what will happen by Friday. Draw prediction pictures for the science wall.",
          ["Celery stalks", "Food colouring", "Clear cups", "Prediction sheets"],
        ),
        block(
          "afternoon",
          "Vegetable printing",
          "Print with halved okra, celery ends and peppers in the art corner. Name the plant part being printed with each stamp.",
          ["Vegetables for printing", "Washable paint", "Paper rolls"],
        ),
      ],
    },
    {
      date: dayISO(3),
      label: WEEKDAY_LABELS[3],
      title: "What do plants drink?",
      blocks: [
        block(
          "morning",
          "Morning circle — watering jobs",
          "Set up the watering rota with group colour cards. Talk about how much is enough — introduce 'too much' and 'too little' with two sad demo plants.",
          ["Rota chart", "Group colour cards"],
        ),
        block(
          "midday",
          "Garden care & shadow hunt",
          "Water the beds according to the rota, then chalk-trace shadows of the tallest garden plants and of a friend. Return later to see the shadow move.",
          ["Watering cans", "Chalk"],
        ),
        block(
          "afternoon",
          "Water play stations",
          "Indoor water stations with cups, funnels and sponges — pouring practice linked to watering skills. Groups of four, ten-minute rotations.",
          ["Basins", "Cups & funnels", "Sponges", "Towels"],
        ),
      ],
    },
    {
      date: dayISO(4),
      label: WEEKDAY_LABELS[4],
      title: "First growth check",
      blocks: [
        block(
          "morning",
          "Morning circle — celery reveal",
          "Check the celery experiment against Wednesday's predictions. Introduce the class growth chart where bean progress will be recorded every week this term.",
          ["Growth chart", "Celery from experiment"],
        ),
        block(
          "midday",
          "Measure & record",
          "Groups check windowsill cups and garden beds with magnifiers, then place a ribbon marker at 'how tall'. Count how many cups show a sprout — record the number together.",
          ["Magnifying glasses", "Measuring ribbons", "Growth chart stickers"],
        ),
        block(
          "afternoon",
          "Show and tell — my seed diary",
          "Each child shares one thing their seed 'did' this week. Send seed diaries home with a note inviting families to water a plant together.",
          ["Seed diary sheets", "Family note slips"],
        ),
      ],
    },
  ],
  materials: [
    { id: "m-1", item: "Bean seeds (soak Monday night)", detail: "2 per child + spares — soak before Tuesday", day: "Tuesday", ready: false },
    { id: "m-2", item: "Marigold seeds", detail: null, day: "Monday", ready: true },
    { id: "m-3", item: "Potting soil", detail: "2 bags from store room", day: "Tuesday", ready: true },
    { id: "m-4", item: "Child trowels & gloves", detail: "count out and back in", day: "Tuesday", ready: true },
    { id: "m-5", item: "Labelled planting cups", detail: "write names Monday afternoon", day: "Tuesday", ready: false },
    { id: "m-6", item: "Magnifying glasses (10)", detail: null, day: null, ready: true },
    { id: "m-7", item: "Celery, food colouring, clear cups", detail: null, day: "Wednesday", ready: false },
    { id: "m-8", item: "Vegetables for printing", detail: "okra, celery ends, peppers", day: "Wednesday", ready: false },
    { id: "m-9", item: "Watering cans labelled by group colour", detail: null, day: "Thursday", ready: true },
    { id: "m-10", item: "Growth chart & ribbon markers", detail: null, day: "Friday", ready: true },
    { id: "m-11", item: "Seed diary sheets", detail: "print 24", day: "Friday", ready: false },
  ],
  observationOpportunities: [
    {
      id: "o-1",
      focus: "Fine motor control (Motor Skills)",
      prompt:
        "During Tuesday's planting, watch how each child handles seeds and pours water — note pincer grip and pouring accuracy for two focus children.",
      day: "Tuesday",
    },
    {
      id: "o-2",
      focus: "Scientific talk (Discovery of the World)",
      prompt:
        "At the celery experiment, record the exact words children use to predict and explain. Listen for cause-and-effect language: because, so that, if.",
      day: "Wednesday",
    },
    {
      id: "o-3",
      focus: "Turn-taking (Social & Emotional)",
      prompt:
        "At the watering rota, observe how children negotiate whose turn it is and how they respond when asked to wait.",
      day: "Thursday",
    },
  ],
  rainyDayAlternatives: [
    {
      id: "rd-1",
      title: "Indoor planting station",
      description:
        "If Tuesday's garden block is rained off, move planting to trays on the covered walkway tables — same sequence cards, same counting.",
      replaces: "Tuesday — Planting in the garden plot",
    },
    {
      id: "rd-2",
      title: "Rain-listening & watering relay",
      description:
        "Swap Thursday's garden care for a rain-listening minute at the window, then a sponge watering relay indoors — the plants get real rain, children keep the pouring practice.",
      replaces: "Thursday — Garden care & shadow hunt",
    },
  ],
  reflectionPrompts: [
    "Which children surprised you at the planting beds, and how might next week's garden jobs stretch them?",
    "Did the celery experiment predictions spark cause-and-effect talk? Capture two quotes for the science wall.",
    "Was the watering rota calm or contested? Adjust group sizes before this becomes the daily routine.",
  ],
  sources: [
    {
      resourceId: id.rCurriculum,
      title: "NEL Curriculum Guide — Kindergarten 1",
      usage: "Learning goals aligned to K1 outcomes for Discovery of the World, Numeracy, Motor Skills and Social & Emotional development.",
    },
    {
      resourceId: id.rLessonTemplate,
      title: "Weekly Lesson Plan Template",
      usage: "Daily rhythm (morning circle → main experience → outdoor → corners) and the checklist/observation/reflection structure follow the centre template.",
    },
    {
      resourceId: id.rGardenList,
      title: "Little Gardeners Materials List",
      usage: "Materials checklist drawn from the store-room inventory and purchase list, including the seed-soaking preparation note.",
    },
    {
      resourceId: id.rSensoryBank,
      title: "Sensory Play Activity Bank",
      usage: "Playdough garden, soil exploration tubs and Thursday's water play stations adapted from the activity bank.",
    },
    {
      resourceId: id.rOutdoorPolicy,
      title: "Outdoor Play & Sun Safety Policy",
      usage: "Garden blocks scheduled before 10:30am; hand-washing after soil contact; wet-weather swap rules.",
    },
    {
      resourceId: id.rRainyDay,
      title: "Rainy Day Indoor Activities",
      usage: "Rainy-day alternatives adapted from the indoor swaps collection.",
    },
  ],
};

export const demoPlan: WeeklyPlan = {
  id: id.plan,
  centreId: id.centre,
  weekStart,
  weekEnd,
  theme: "Little Gardeners: How Plants Grow",
  ageGroup: "K1",
  className: "K1 Sunbeams",
  status: "ready",
  currentVersion: 1,
  createdBy: null,
  createdAt: hoursAgo(11),
  updatedAt: hoursAgo(11),
};

export const demoPlanVersions: WeeklyPlanVersion[] = [
  {
    id: id.planV1,
    weeklyPlanId: id.plan,
    versionNumber: 1,
    content: demoPlanContent,
    changeSummary: "Atlas prepared this week from your curriculum and 6 centre resources.",
    createdBy: null,
    createdByName: null,
    createdByAtlas: true,
    createdAt: hoursAgo(11),
  },
];

// ── Atlas Feed ──────────────────────────────────────────────────────────────

export const demoFeedItems: FeedItem[] = [
  {
    id: id.fWeekReady,
    centreId: id.centre,
    type: "week_ready",
    title: `Week of ${weekStart.slice(8, 10)}–${weekEnd.slice(8, 10)} is ready`,
    summary:
      "Atlas prepared “Little Gardeners: How Plants Grow” for K1 Sunbeams using your curriculum guide and 5 other centre resources.",
    reviewMinutes: 6,
    actionLabel: "Review the week",
    actionHref: `/week/${id.plan}`,
    status: "unread",
    event: "weekly_plan_generated",
    metadata: { planId: id.plan },
    createdAt: hoursAgo(11),
  },
  {
    id: id.fMaterials,
    centreId: id.centre,
    type: "materials_ready",
    title: "Materials checklist prepared",
    summary:
      "11 items for the week — 4 need preparing ahead, including bean seeds to soak on Monday night.",
    reviewMinutes: 2,
    actionLabel: "Check materials",
    actionHref: `/week/${id.plan}#materials`,
    status: "unread",
    event: "weekly_plan_generated",
    metadata: { planId: id.plan },
    createdAt: hoursAgo(11),
  },
  {
    id: id.fObservations,
    centreId: id.centre,
    type: "observations_ready",
    title: "3 observation opportunities found",
    summary:
      "Moments this week suit fine-motor, scientific-talk and turn-taking observations — matched to your observation record template.",
    reviewMinutes: 2,
    actionLabel: "See opportunities",
    actionHref: `/week/${id.plan}#observations`,
    status: "unread",
    event: "weekly_plan_generated",
    metadata: { planId: id.plan },
    createdAt: hoursAgo(11),
  },
  {
    id: id.fWeather,
    centreId: id.centre,
    type: "weather_adjustment",
    title: "Thunderstorms likely Thursday afternoon",
    summary:
      "Atlas added indoor alternatives for Thursday's garden block, adapted from your rainy-day collection.",
    reviewMinutes: 1,
    actionLabel: "See alternatives",
    actionHref: `/week/${id.plan}#rainy-day`,
    status: "unread",
    event: "weekly_plan_updated",
    metadata: { planId: id.plan, demo: true },
    createdAt: hoursAgo(5),
  },
  {
    id: id.fResources,
    centreId: id.centre,
    type: "resources_added",
    title: "2 new resources in Centre Intelligence",
    summary:
      "Mei Lin contributed “Shadow Puppet Theatre” and Priya uploaded “Water Play Stations”. Both are classified and searchable.",
    reviewMinutes: 1,
    actionLabel: "Browse the library",
    actionHref: "/centre",
    status: "unread",
    event: "teacher_contributed_resource",
    metadata: { resourceIds: [id.rShadowPuppet, id.rWaterPlay] },
    createdAt: hoursAgo(14),
  },
  {
    id: id.fDuplicate,
    centreId: id.centre,
    type: "duplicate_found",
    title: "“Water Play Stations” looks similar to an existing resource",
    summary:
      "It overlaps with “Sensory Play Activity Bank”. You can merge them, keep both as a fork, or keep them separate.",
    reviewMinutes: 2,
    actionLabel: "Compare",
    actionHref: "/review",
    status: "unread",
    event: "duplicate_detected",
    metadata: {
      newResourceId: id.rWaterPlay,
      existingResourceId: id.rSensoryBank,
      similarity: 0.58,
    },
    createdAt: hoursAgo(15),
  },
];

// ── Contributions & notes ───────────────────────────────────────────────────

export const demoContributionEvents: ContributionEvent[] = [
  {
    id: "ce-1",
    centreId: id.centre,
    userId: id.meilin,
    userName: "Mei Lin Chong",
    resourceId: id.rShadowPuppet,
    resourceTitle: "Shadow Puppet Theatre",
    eventType: "contributed",
    metadata: {},
    createdAt: hoursAgo(26),
  },
  {
    id: "ce-2",
    centreId: id.centre,
    userId: id.priya,
    userName: "Priya Nair",
    resourceId: id.rWaterPlay,
    resourceTitle: "Water Play Stations",
    eventType: "uploaded",
    metadata: {},
    createdAt: hoursAgo(15),
  },
  {
    id: "ce-3",
    centreId: id.centre,
    userId: id.priya,
    userName: "Priya Nair",
    resourceId: id.rGardenList,
    resourceTitle: "Little Gardeners Materials List",
    eventType: "uploaded",
    metadata: {},
    createdAt: daysAgo(14),
  },
];

export const demoNotes: PrivateTeacherNote[] = [
  {
    id: "n-1",
    centreId: id.centre,
    userId: id.sarah,
    weeklyPlanId: id.plan,
    title: "For garden week",
    content:
      "Jun Kai and Aisha both asked about worms last week — work them into soil exploration. Check allergy list before smell pots.",
    createdAt: daysAgo(3),
  },
];
