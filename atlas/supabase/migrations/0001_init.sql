-- Atlas — initial schema
-- Tables for centres, users, Centre Intelligence (resources), weekly planning,
-- the Atlas Feed, private notes and contribution events. pgvector-ready.

create extension if not exists "pgcrypto";
create extension if not exists vector;

-- ── Helpers ─────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── Workspace ───────────────────────────────────────────────────────────────

create table public.centres (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  timezone   text not null default 'Asia/Singapore',
  created_at timestamptz not null default now()
);

create table public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  created_at timestamptz not null default now()
);

-- Mirror auth signups into public.users.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'Teacher'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.centre_members (
  centre_id  uuid not null references public.centres (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  role       text not null default 'teacher' check (role in ('teacher', 'lead')),
  created_at timestamptz not null default now(),
  primary key (centre_id, user_id)
);

create index centre_members_user_idx on public.centre_members (user_id);

-- ── Centre Intelligence ─────────────────────────────────────────────────────

create table public.resources (
  id                 uuid primary key default gen_random_uuid(),
  centre_id          uuid not null references public.centres (id) on delete cascade,
  title              text not null,
  description        text,
  type               text not null default 'other' check (type in (
    'curriculum', 'lesson_template', 'observation_template', 'policy', 'activity',
    'weekly_plan', 'newsletter', 'resource_list', 'note', 'other'
  )),
  status             text not null default 'ready' check (status in ('processing', 'ready', 'archived', 'merged')),
  -- Privacy-conscious default: uploads start private; sharing is an explicit choice.
  visibility         text not null default 'private' check (visibility in ('centre', 'private')),
  file_path          text,
  mime_type          text,
  original_filename  text,
  has_extracted_text boolean not null default false,
  current_version    integer not null default 1,
  created_by         uuid references public.users (id) on delete set null,
  contributed        boolean not null default false,
  forked_from        uuid references public.resources (id) on delete set null,
  merged_into        uuid references public.resources (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index resources_centre_idx on public.resources (centre_id, status, updated_at desc);
create trigger resources_updated_at before update on public.resources
  for each row execute function public.set_updated_at();

create table public.resource_versions (
  id               uuid primary key default gen_random_uuid(),
  resource_id      uuid not null references public.resources (id) on delete cascade,
  version_number   integer not null,
  title            text not null,
  extracted_text   text not null default '',
  change_note      text,
  created_by       uuid references public.users (id) on delete set null,
  created_by_atlas boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (resource_id, version_number)
);

create table public.resource_chunks (
  id             uuid primary key default gen_random_uuid(),
  resource_id    uuid not null references public.resources (id) on delete cascade,
  -- Denormalised for cheap corpus queries and RLS.
  centre_id      uuid not null references public.centres (id) on delete cascade,
  version_id     uuid not null references public.resource_versions (id) on delete cascade,
  chunk_index    integer not null default 0,
  content        text not null,
  token_estimate integer not null default 0,
  -- pgvector-ready: populated by a post-MVP embedding pass.
  embedding      vector(1536),
  tsv            tsvector generated always as (to_tsvector('english', content)) stored,
  created_at     timestamptz not null default now()
);

create index resource_chunks_centre_idx on public.resource_chunks (centre_id);
create index resource_chunks_resource_idx on public.resource_chunks (resource_id);
create index resource_chunks_tsv_idx on public.resource_chunks using gin (tsv);
-- TODO(post-MVP): create index resource_chunks_embedding_idx on public.resource_chunks
--   using hnsw (embedding vector_cosine_ops);

create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  centre_id  uuid not null references public.centres (id) on delete cascade,
  name       text not null,
  kind       text not null default 'custom' check (kind in ('domain', 'age_group', 'format', 'custom')),
  created_at timestamptz not null default now()
);

create unique index tags_centre_name_idx on public.tags (centre_id, lower(name));

create table public.resource_tags (
  resource_id  uuid not null references public.resources (id) on delete cascade,
  tag_id       uuid not null references public.tags (id) on delete cascade,
  suggested_by text not null default 'atlas' check (suggested_by in ('atlas', 'teacher')),
  created_at   timestamptz not null default now(),
  primary key (resource_id, tag_id)
);

-- ── Weekly planning ─────────────────────────────────────────────────────────

create table public.weekly_plans (
  id              uuid primary key default gen_random_uuid(),
  centre_id       uuid not null references public.centres (id) on delete cascade,
  week_start      date not null,
  week_end        date not null,
  theme           text not null,
  age_group       text not null,
  class_name      text,
  status          text not null default 'ready' check (status in ('generating', 'ready', 'approved')),
  current_version integer not null default 0,
  created_by      uuid references public.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index weekly_plans_centre_idx on public.weekly_plans (centre_id, week_start desc);
create trigger weekly_plans_updated_at before update on public.weekly_plans
  for each row execute function public.set_updated_at();

create table public.weekly_plan_versions (
  id               uuid primary key default gen_random_uuid(),
  weekly_plan_id   uuid not null references public.weekly_plans (id) on delete cascade,
  version_number   integer not null,
  content          jsonb not null,
  change_summary   text,
  created_by       uuid references public.users (id) on delete set null,
  created_by_atlas boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (weekly_plan_id, version_number)
);

-- ── Atlas Feed, notes, contributions ───────────────────────────────────────

create table public.atlas_feed_items (
  id             uuid primary key default gen_random_uuid(),
  centre_id      uuid not null references public.centres (id) on delete cascade,
  type           text not null,
  title          text not null,
  summary        text not null,
  review_minutes integer,
  action_label   text,
  action_href    text,
  status         text not null default 'unread' check (status in ('unread', 'reviewed', 'dismissed')),
  event          text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index atlas_feed_items_centre_idx on public.atlas_feed_items (centre_id, status, created_at desc);

create table public.private_teacher_notes (
  id             uuid primary key default gen_random_uuid(),
  centre_id      uuid not null references public.centres (id) on delete cascade,
  user_id        uuid not null references public.users (id) on delete cascade,
  weekly_plan_id uuid references public.weekly_plans (id) on delete set null,
  title          text,
  content        text not null,
  created_at     timestamptz not null default now()
);

create index private_teacher_notes_user_idx on public.private_teacher_notes (user_id, created_at desc);

create table public.contribution_events (
  id          uuid primary key default gen_random_uuid(),
  centre_id   uuid not null references public.centres (id) on delete cascade,
  user_id     uuid references public.users (id) on delete set null,
  resource_id uuid references public.resources (id) on delete set null,
  event_type  text not null check (event_type in ('uploaded', 'contributed', 'edited', 'merged', 'forked')),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index contribution_events_centre_idx on public.contribution_events (centre_id, created_at desc);
