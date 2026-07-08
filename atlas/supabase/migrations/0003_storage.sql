-- Atlas — storage bucket for original uploaded files
-- Path convention: {centre_id}/{resource_id}/{filename}
-- The app writes via the service role; these policies additionally allow
-- centre members to read (and future client-side flows to write) their own
-- centre's files.

insert into storage.buckets (id, name, public)
values ('resources', 'resources', false)
on conflict (id) do nothing;

create policy "centre members read centre files"
  on storage.objects for select
  using (
    bucket_id = 'resources'
    and public.is_centre_member(((storage.foldername(name))[1])::uuid)
  );

create policy "centre members upload centre files"
  on storage.objects for insert
  with check (
    bucket_id = 'resources'
    and public.is_centre_member(((storage.foldername(name))[1])::uuid)
  );

create policy "centre members update centre files"
  on storage.objects for update
  using (
    bucket_id = 'resources'
    and public.is_centre_member(((storage.foldername(name))[1])::uuid)
  );
