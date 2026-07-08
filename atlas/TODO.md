# Atlas — TODO

Prioritised. Items marked 🔒 gate multi-teacher production use; 🧠 are intelligence-quality; ✨ are polish.

## Now (before first real centre)

- [ ] 🔒 **Centre invites** — RLS currently only allows joining an *empty* centre (onboarding bootstrap). Add invite links / email invites so colleagues can join an existing centre. (`supabase/migrations/0002_rls.sql`, onboarding flow)
- [ ] 🔒 **Real document parsing** — swap the placeholder branch in `core/resources/parser.ts` for LlamaParse, Unstructured, or Azure Document Intelligence (PDF/DOCX/PPTX), plus OCR for images. The interface is already shaped for it.
- [ ] 🔒 **Background processing** — the upload pipeline and plan generation run in-request. Move parse/classify/generate onto a queue (Supabase queues / pg_cron / Inngest) so big uploads never block, and set `weekly_plans.status = 'generating'` while Atlas works. (`core/events/bus.ts` TODO)
- [ ] **Signed download link for originals** — `core/resources/storage.ts#getOriginalFileUrl` exists; surface a "Download original" action on the resource page.

## Next (intelligence quality)

- [ ] 🧠 **Embeddings** — populate `resource_chunks.embedding` (pgvector column + HNSW index are ready) on version create; use for semantic search rerank and duplicate detection beyond shared vocabulary.
- [ ] 🧠 **Postgres-side search** — move `core/centre-intelligence/search.ts` scoring into an FTS RPC (tsv index already exists), then blend with embedding similarity. In-process scoring is fine for hundreds of resources, not thousands.
- [ ] 🧠 **LLM source summaries** — `summarizeSourceUsage` is deterministic; wire `prompts/source-summary.ts` for richer "what Atlas used" copy on AI-generated plans.
- [ ] 🧠 **Morning briefing synthesis** — a daily pass that condenses many small feed events into one calm paragraph (see `generateFeedItems` TODO).
- [ ] 🧠 **Real weather integration** — the "thunderstorms Thursday" feed item is illustrative seed data. Integrate a weather API keyed to the centre's location and emit `weather_adjustment` events for outdoor blocks.
- [ ] 🧠 **Prior-plan continuity** — feed last week's approved plan into `gatherPlanContext` with higher weight so themes build across the term.

## Later (product surface)

- [ ] ✨ DOCX / PDF export (`core/weekly-planning/markdown.ts` TODO)
- [ ] ✨ Duplicate compare view — side-by-side diff of the two resources before merge/fork
- [ ] ✨ Drag-to-reorder blocks and days in the plan editor
- [ ] ✨ Autosave drafts in the plan editor (currently explicit Save; dirty-state warning only)
- [ ] ✨ Observation capture — turn observation opportunities into filled observation records using the centre's template
- [ ] ✨ Tag management page (rename/merge tags); tags currently grow organically
- [ ] Community — replace the placeholder with cross-centre sharing (explicitly out of MVP scope)
- [ ] Generated Supabase types (`supabase gen types typescript`) to replace hand-kept `lib/types/database.ts`
- [ ] Tests: unit tests for `similarity.ts`, `chunker.ts`, `classify-resource.ts` heuristics, and the deterministic plan generator; an e2e pass over upload → review → approve

## Known limitations (accepted for MVP)

- Preview mode state is per-process and resets on restart (by design).
- `weekly_plan_versions.created_by_name` is not joined in connected mode (shows "Teacher"); join `users` when it matters.
- Roles exist (`teacher` / `lead`) but carry no permission differences yet — deliberate ("no complex role permissions").
- No delete/archive UI for resources (archive status exists in schema).
