-- Atlas — row-level security
-- Rule of the house: users only ever see their own centre's data, and other
-- teachers' private resources stay private.

-- ── Helpers (security definer so policies don't recurse) ───────────────────

create or replace function public.is_centre_member(target_centre uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.centre_members
    where centre_id = target_centre and user_id = auth.uid()
  );
$$;

create or replace function public.shares_centre_with(target_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.centre_members mine
    join public.centre_members theirs on mine.centre_id = theirs.centre_id
    where mine.user_id = auth.uid() and theirs.user_id = target_user
  );
$$;

create or replace function public.centre_has_members(target_centre uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.centre_members where centre_id = target_centre);
$$;

-- Can the current user see this resource? (member + visibility)
create or replace function public.can_access_resource(target_resource uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.resources r
    where r.id = target_resource
      and public.is_centre_member(r.centre_id)
      and (r.visibility = 'centre' or r.created_by = auth.uid())
  );
$$;

-- ── Enable RLS everywhere ───────────────────────────────────────────────────

alter table public.centres               enable row level security;
alter table public.users                 enable row level security;
alter table public.centre_members        enable row level security;
alter table public.resources             enable row level security;
alter table public.resource_versions     enable row level security;
alter table public.resource_chunks       enable row level security;
alter table public.tags                  enable row level security;
alter table public.resource_tags         enable row level security;
alter table public.weekly_plans          enable row level security;
alter table public.weekly_plan_versions  enable row level security;
alter table public.atlas_feed_items      enable row level security;
alter table public.private_teacher_notes enable row level security;
alter table public.contribution_events   enable row level security;

-- ── centres ─────────────────────────────────────────────────────────────────

create policy "members read their centre" on public.centres
  for select using (public.is_centre_member(id));
create policy "signed-in users can create a centre" on public.centres
  for insert with check (auth.uid() is not null);
create policy "members update their centre" on public.centres
  for update using (public.is_centre_member(id));

-- ── users ───────────────────────────────────────────────────────────────────

create policy "read self and centre colleagues" on public.users
  for select using (id = auth.uid() or public.shares_centre_with(id));
create policy "insert own profile" on public.users
  for insert with check (id = auth.uid());
create policy "update own profile" on public.users
  for update using (id = auth.uid());

-- ── centre_members ──────────────────────────────────────────────────────────

create policy "members see membership of their centres" on public.centre_members
  for select using (public.is_centre_member(centre_id));
-- Bootstrap only: you may add yourself to a centre that has no members yet
-- (the onboarding flow). Invites/joins for established centres are post-MVP.
create policy "join empty centre as self" on public.centre_members
  for insert with check (
    user_id = auth.uid() and not public.centre_has_members(centre_id)
  );

-- ── resources ───────────────────────────────────────────────────────────────

create policy "members read shared or own resources" on public.resources
  for select using (
    public.is_centre_member(centre_id)
    and (visibility = 'centre' or created_by = auth.uid())
  );
create policy "members create resources in their centre" on public.resources
  for insert with check (
    public.is_centre_member(centre_id) and created_by = auth.uid()
  );
-- Shared resources are collaboratively editable (no approval bottlenecks);
-- private resources are editable by their owner only.
create policy "members update accessible resources" on public.resources
  for update using (
    public.is_centre_member(centre_id)
    and (visibility = 'centre' or created_by = auth.uid())
  );

-- ── resource_versions / chunks / tags ──────────────────────────────────────

create policy "versions follow their resource" on public.resource_versions
  for select using (public.can_access_resource(resource_id));
create policy "versions insert follows resource" on public.resource_versions
  for insert with check (public.can_access_resource(resource_id));

create policy "chunks follow their resource" on public.resource_chunks
  for select using (public.can_access_resource(resource_id));
create policy "chunks insert follows resource" on public.resource_chunks
  for insert with check (public.can_access_resource(resource_id));
create policy "chunks delete follows resource" on public.resource_chunks
  for delete using (public.can_access_resource(resource_id));

create policy "members read centre tags" on public.tags
  for select using (public.is_centre_member(centre_id));
create policy "members create centre tags" on public.tags
  for insert with check (public.is_centre_member(centre_id));
create policy "members update centre tags" on public.tags
  for update using (public.is_centre_member(centre_id));

create policy "resource tags follow their resource" on public.resource_tags
  for select using (public.can_access_resource(resource_id));
create policy "resource tags insert follows resource" on public.resource_tags
  for insert with check (public.can_access_resource(resource_id));
create policy "resource tags delete follows resource" on public.resource_tags
  for delete using (public.can_access_resource(resource_id));

-- ── weekly plans ────────────────────────────────────────────────────────────

create policy "members read centre plans" on public.weekly_plans
  for select using (public.is_centre_member(centre_id));
create policy "members create centre plans" on public.weekly_plans
  for insert with check (public.is_centre_member(centre_id));
create policy "members update centre plans" on public.weekly_plans
  for update using (public.is_centre_member(centre_id));

create policy "plan versions follow their plan" on public.weekly_plan_versions
  for select using (exists (
    select 1 from public.weekly_plans p
    where p.id = weekly_plan_id and public.is_centre_member(p.centre_id)
  ));
create policy "plan versions insert follows plan" on public.weekly_plan_versions
  for insert with check (exists (
    select 1 from public.weekly_plans p
    where p.id = weekly_plan_id and public.is_centre_member(p.centre_id)
  ));

-- ── feed / notes / contributions ────────────────────────────────────────────

create policy "members read centre feed" on public.atlas_feed_items
  for select using (public.is_centre_member(centre_id));
create policy "members create centre feed items" on public.atlas_feed_items
  for insert with check (public.is_centre_member(centre_id));
create policy "members update centre feed items" on public.atlas_feed_items
  for update using (public.is_centre_member(centre_id));

create policy "notes are strictly personal — read" on public.private_teacher_notes
  for select using (user_id = auth.uid());
create policy "notes are strictly personal — write" on public.private_teacher_notes
  for insert with check (user_id = auth.uid());
create policy "notes are strictly personal — update" on public.private_teacher_notes
  for update using (user_id = auth.uid());
create policy "notes are strictly personal — delete" on public.private_teacher_notes
  for delete using (user_id = auth.uid());

create policy "members read centre contributions" on public.contribution_events
  for select using (public.is_centre_member(centre_id));
create policy "members record centre contributions" on public.contribution_events
  for insert with check (public.is_centre_member(centre_id));
