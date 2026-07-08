# Atlas

**A calm, AI-native preschool work platform.**
Atlas works. Teachers review.

Atlas prepares the upcoming teaching week from the centre's own curriculum, templates and resources (Centre Intelligence). Teachers review, edit, approve — and contribute their own materials back. It is deliberately **not** a preschool ERP: no attendance, no billing, no parent portal, no child profiles.

---

## Quick start (zero configuration)

```bash
cd atlas
npm install
npm run dev
```

Open http://localhost:3000. With no environment variables set, Atlas runs in **preview mode**: a fully working in-memory workspace ("Sunny Grove Preschool") with seeded Centre Intelligence, a prepared week, and a live morning briefing. Every flow works — upload, classification, tagging, duplicate detection, weekly plan generation, editing, versioning, export — using the deterministic planning engine. Preview data resets when the server restarts.

## Going live with Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migrations in order in the SQL editor (or `supabase db push`):
   - `supabase/migrations/0001_init.sql` — tables, triggers, pgvector-ready schema
   - `supabase/migrations/0002_rls.sql` — row-level security
   - `supabase/migrations/0003_storage.sql` — storage bucket + policies
3. Copy `.env.example` to `.env.local` and fill in:

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...        # server-only, used for storage writes
   ```

4. Restart, sign up in the app (creates your user + onboarding creates your centre), **or** — to start with the sample centre — sign up first, then run `supabase/seed.sql`, which attaches Sunny Grove Preschool (resources, weekly plan, feed) to the first auth user.
5. For local development you may want to disable "Confirm email" under Supabase Auth settings, or configure SMTP.

## Connecting real intelligence

Atlas runs its AI layer behind a provider abstraction (`core/ai`). Without a key it uses a deterministic planning engine; with one, generation is grounded in your centre's documents via the prompts in `/prompts`.

```
AI_PROVIDER=anthropic   # or: openai | mock (optional — auto-detected from keys)
ANTHROPIC_API_KEY=...   # or OPENAI_API_KEY
```

Provider, model and parameters are never exposed in the product — teachers choose outcomes, not models. Deterministic code handles what it can (duplicate detection, tag heuristics, feed copy); the LLM is reserved for genuinely generative work and every call has a deterministic fallback, so AI failure degrades quality, never availability.

## What works · what is mocked · what needs keys

| Area | Status |
| --- | --- |
| App shell, Today briefing, Review, Search, Centre, Settings, Community placeholder | ✅ Works everywhere |
| Upload pipeline (store → parse → version → chunk → classify → tag → duplicate check → feed) | ✅ Works everywhere |
| Text extraction for `.txt` / `.md` / `.csv` / JSON | ✅ Works |
| Text extraction for PDF / DOCX / PPTX / images | 🟡 Placeholder — original stored, clear TODO for LlamaParse / Unstructured / Azure Document Intelligence (`core/resources/parser.ts`) |
| Weekly plan generation with cited sources | ✅ Works — deterministic engine without keys; LLM-grounded with `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` |
| Section regeneration, manual editing, versioning, restore | ✅ Works everywhere |
| Duplicate detection (merge / fork / keep separate) | ✅ Works — deterministic similarity, no LLM by design |
| Search across Centre Intelligence | ✅ Works — in-process scoring; FTS index + pgvector column ready for the scale path |
| Atlas Feed from events | ✅ Works everywhere |
| Export (copy markdown / download .md) | ✅ Works — DOCX/PDF are TODO |
| Auth, Postgres persistence, file storage, RLS | 🔑 Needs Supabase keys (preview mode is in-memory otherwise) |
| The "weather changed" feed item | 🟡 Illustrative seed data — no weather API integration yet |
| Embeddings in `resource_chunks.embedding` | 🟡 Schema ready (pgvector), not populated in MVP |

## Architecture

```
app/                      # routes only — pages call services, no business logic
  (auth)/                 # login, onboarding
  (dashboard)/            # today, review, search, centre, week, settings, community
  actions/                # server actions (thin wrappers over core services)
  api/                    # upload + search route handlers, auth callback
components/
  ui/                     # shadcn-style primitives (button, card, dialog, …)
  layout/ cards/ editor/ upload/ search/
core/                     # business logic — framework-free where possible
  ai/                     # provider abstraction + the 7 AI service functions
    providers/            # anthropic.ts, openai.ts (fetch-based, swappable)
    services/             # classifyResource, suggestTags, detectDuplicates,
                          # generateWeeklyPlan, regenerateSection,
                          # summarizeSourceUsage, generateFeedItems
  events/                 # typed event bus → Atlas Feed projection
  resources/              # upload pipeline, parser + chunker abstractions, repo
  weekly-planning/        # plan service, repo, markdown export
  centre-intelligence/    # search + plan-context gathering
  duplicates/             # deterministic similarity + merge/fork/keep service
  versioning/             # resource version rules (never overwrite silently)
  workspace/              # current user + centre resolution
lib/
  supabase/               # browser/server/admin clients, middleware
  demo/                   # preview-mode fixtures + in-memory store
  types/ utils/           # domain types, date/text helpers
prompts/                  # all LLM prompts live here, never in UI
supabase/
  migrations/ seed.sql
```

Key decisions:

- **Repository layer branches on mode** — every data function works against Supabase (RLS-scoped) or the in-memory demo store, so the product is reviewable with zero setup and the swap surface is one file per domain.
- **Events → Feed** — actions emit typed events (`resource_parsed`, `duplicate_detected`, `weekly_plan_generated`, …); handlers project them into calm feed copy. The teacher's own foreground edits deliberately don't spam the feed.
- **Versioning is append-only** — edits, merges, regenerations and restores all create new versions; chunks always reflect the latest version.
- **Privacy-conscious defaults** — uploads start private; sharing to Centre Intelligence is an explicit choice ("Would you like other teachers to benefit from this?"); RLS scopes everything to centre membership; private notes are `user_id = auth.uid()` only; no child profiles.

## Deployment (Vercel)

Set the project **Root Directory** to `atlas/`, add the environment variables above, deploy. No other configuration is needed (`next build` is clean; upload route runs on the Node runtime).

## Security notes

- All 13 tables carry RLS; helper functions are `security definer` to avoid policy recursion.
- Centre joining is bootstrap-only (you can only add yourself to an empty centre); invites are a listed TODO — do not ship multi-teacher onboarding without them.
- The service-role key is used server-side only (storage writes). Never expose it to the browser.
- Uploads are capped at 15 MB / 10 files per request and type-checked; filenames are sanitised before storage.
- Atlas never trains on centre data, and the product says so where teachers can see it.

## Scripts

```bash
npm run dev          # develop
npm run build        # production build (typed, strict)
npm run start        # serve the build
npm run typecheck    # tsc --noEmit
```

See `TODO.md` for the prioritised roadmap.
