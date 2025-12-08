-- =========================================
-- bootstrap.sql — projects + field_notes + overlays
-- Soft-delete enforced, edit_history auto-diffs all changes
-- =========================================

create extension if not exists pgcrypto;

-- -----------------------------------------
-- DROP EXISTING TABLES (to avoid legacy schema cruft)
-- -----------------------------------------
drop table if exists public.field_notes cascade;
drop table if exists public.project_edit_history cascade;
drop table if exists public.project_overlays cascade;
drop table if exists public.projects cascade;

-- -----------------------------------------
-- PROJECTS
-- -----------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  status      text not null default 'active' check (status in ('active','completed','planned')),
  start_date  date,
  location    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- touch updated_at on projects
drop trigger if exists trg_projects_updated_at on public.projects;
drop function if exists public.tfn_touch_projects_updated_at();
create or replace function public.tfn_touch_projects_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.tfn_touch_projects_updated_at();

-- generic project history diffs
drop table if exists public.project_edit_history;
create table public.project_edit_history (
  id         bigserial primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  diff       jsonb not null
);

drop trigger if exists trg_projects_history on public.projects;
drop function if exists public.tfn_log_project_history();
create or replace function public.tfn_log_project_history()
returns trigger language plpgsql as $$
declare
  oldj jsonb;
  newj jsonb;
  d    jsonb := '{}'::jsonb;
  k    text;
begin
  oldj := to_jsonb(old.*);
  newj := to_jsonb(new.*);

  -- exclude audit/derived keys
  oldj := oldj - array['created_at','updated_at'];
  newj := newj - array['created_at','updated_at'];

  -- build diff
  for k in select key from jsonb_each(oldj) loop
    if oldj->k is distinct from newj->k then
      d := d || jsonb_build_object(
        k, jsonb_build_object(
          'old', oldj->k,
          'new', newj->k
        )
      );
    end if;
  end loop;

  if d <> '{}'::jsonb then
    insert into public.project_edit_history(project_id, changed_by, diff)
    values (new.id, auth.uid(), d);
  end if;

  return new;
end$$;

create trigger trg_projects_history
after update on public.projects
for each row execute function public.tfn_log_project_history();

-- -----------------------------------------
-- FIELD_NOTES
-- -----------------------------------------
create table if not exists public.field_notes (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  created_by       uuid not null references auth.users(id) on delete cascade,
  created_by_name  text,
  project_name     text,

  latitude         double precision,
  longitude        double precision,
  geometry         jsonb,

  asset_type       text not null default 'Unknown'
                   check (asset_type in (
                     'Hand Hole',
                     'Vault',
                     'Pedestal',
                     'Flower Pot',
                     'MST',
                     'Conduit',
                     'Cable',
                     'Slack Loop',
                     'Building',
                     'Cabinet',
                     'Pole',
                     'Tower',
                     'Other',
                     'Unknown'
                   )),

  notes            text,
  photos           text[] default '{}',

  is_deleted       boolean not null default false,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  edit_history     jsonb default '[]'::jsonb
);

-- Ensure asset_type CHECK constraint is exactly what we want
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.field_notes'::regclass
      and conname = 'field_notes_asset_type_check'
  ) then
    alter table public.field_notes
      drop constraint field_notes_asset_type_check;
  end if;

  alter table public.field_notes
    add constraint field_notes_asset_type_check
    check (asset_type in (
      'Hand Hole',
      'Vault',
      'Pedestal',
      'Flower Pot',
      'MST',
      'Conduit',
      'Cable',
      'Slack Loop',
      'Building',
      'Cabinet',
      'Pole',
      'Tower',
      'Other',
      'Unknown'
    ));
end
$$;

-- backfill geometry as Point if missing but lat/lon exist
update public.field_notes
set geometry = jsonb_build_object(
  'type', 'Point',
  'coordinates', jsonb_build_array(longitude, latitude)
)
where geometry is null
  and latitude is not null
  and longitude is not null;

-- indexes for field_notes
create index if not exists idx_field_notes_project_id   on public.field_notes(project_id);
create index if not exists idx_field_notes_created_by   on public.field_notes(created_by);
create index if not exists idx_field_notes_created_at   on public.field_notes(created_at);
create index if not exists idx_field_notes_is_deleted   on public.field_notes(is_deleted);

-- updated_at touch on field_notes
drop trigger if exists trg_field_notes_updated_at on public.field_notes;
drop function if exists public.tfn_touch_field_notes_updated_at();
create or replace function public.tfn_touch_field_notes_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

create trigger trg_field_notes_updated_at
before update on public.field_notes
for each row execute function public.tfn_touch_field_notes_updated_at();

-- -----------------------------------------
-- FIELD_NOTES edit_history: generic diff of ALL non-audit columns
-- -----------------------------------------
/*
  We diff to_jsonb(OLD) vs to_jsonb(NEW), excluding audit/derived keys.
  Any changed key yields: diff[key] = {"old":<old>, "new":<new>}
*/
drop trigger if exists trg_field_notes_history on public.field_notes;
drop function if exists public.tfn_log_field_notes_history();
create or replace function public.tfn_log_field_notes_history()
returns trigger language plpgsql as $$
declare
  oldj  jsonb;
  newj  jsonb;
  patch jsonb;
  k     text;
begin
  oldj := to_jsonb(old.*);
  newj := to_jsonb(new.*);

  -- exclude audit/derived keys
  oldj := oldj - array['created_at','updated_at','edit_history'];
  newj := newj - array['created_at','updated_at','edit_history'];

  -- build diff object
  patch := '{}'::jsonb;

  for k in select key from jsonb_each(oldj) loop
    if oldj->k is distinct from newj->k then
      patch := patch || jsonb_build_object(
        k, jsonb_build_object(
          'old', oldj->k,
          'new', newj->k
        )
      );
    end if;
  end loop;

  if patch <> '{}'::jsonb then
    new.edit_history := coalesce(old.edit_history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'changed_at', now(),
        'changed_by', auth.uid(),
        'diff', patch
      )
    );
  end if;

  return new;
end$$;

create trigger trg_field_notes_history
before update on public.field_notes
for each row execute function public.tfn_log_field_notes_history();

-- =========================================
-- PROJECT_OVERLAYS (per-project overlay files such as GeoJSON)
-- =========================================
drop table if exists public.project_overlays cascade;

create table public.project_overlays (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  name         text not null,
  description  text,
  storage_path text not null,
  file_type    text not null check (file_type in ('geojson','gpkg','shpzip')),
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  is_active    boolean not null default true,
  style        jsonb not null default '{}'::jsonb
);

-- =========================================
-- RLS: PROJECT_OVERLAYS (org-shared)
-- =========================================
alter table public.project_overlays enable row level security;
alter table public.project_overlays force row level security;

drop policy if exists "overlays_select_any" on public.project_overlays;
create policy "overlays_select_any"
  on public.project_overlays for select
  to authenticated
  using (true);

drop policy if exists "overlays_insert_project_member" on public.project_overlays;
create policy "overlays_insert_project_member"
  on public.project_overlays for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.projects p
      where p.id = project_id
    )
  );

drop policy if exists "overlays_update_any" on public.project_overlays;
create policy "overlays_update_any"
  on public.project_overlays for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "overlays_delete_any" on public.project_overlays;
create policy "overlays_delete_any"
  on public.project_overlays for delete
  to authenticated
  using (true);

-- =========================================
-- RLS: PROJECTS (org-shared)
-- =========================================
alter table public.projects enable row level security;
alter table public.projects force row level security;

-- Any authenticated user can see all projects (org-shared)
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
  on public.projects for select
  to authenticated
  using (true);

-- Any authenticated user can insert projects for themselves
drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
  on public.projects for insert
  to authenticated
  with check (user_id = auth.uid());

-- Any authenticated user can update any project (org-shared)
drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
  on public.projects for update
  to authenticated
  using (true)
  with check (true);

-- Any authenticated user can delete any project (org-shared)
drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
  on public.projects for delete
  to authenticated
  using (true);

-- =========================================
-- RLS: FIELD_NOTES (org-shared reads, soft-delete via helper)
-- =========================================
alter table public.field_notes enable row level security;
alter table public.field_notes force row level security;

drop policy if exists "field_notes_select_visible_project_owner_or_creator" on public.field_notes;
drop policy if exists "field_notes_insert_creator_project_owner" on public.field_notes;
drop policy if exists "field_notes_update_project_owner_or_creator" on public.field_notes;
-- NOTE: intentionally no DELETE policy => users cannot hard delete directly

-- Read: any authenticated user can see non-deleted notes (org-shared)
create policy "field_notes_select_visible_project_owner_or_creator"
  on public.field_notes for select
  to authenticated
  using (
    is_deleted = false
  );

-- Insert: creator must be the authed user; project just has to exist
create policy "field_notes_insert_creator_project_owner"
  on public.field_notes for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id
    )
  );

-- Update: any authenticated user can update any note (org-shared)
create policy "field_notes_update_project_owner_or_creator"
  on public.field_notes for update
  to authenticated
  using (true)
  with check (true);

-- Convenience: secure function to list deleted notes for a project
drop function if exists public.field_notes_list_deleted(uuid);
create or replace function public.field_notes_list_deleted(p_project_id uuid)
returns setof public.field_notes
language sql
security definer
set search_path = public
as $$
  select *
  from public.field_notes fn
  where fn.project_id = p_project_id
    and fn.is_deleted = true
    and (
      exists (
        select 1
        from public.projects p
        where p.id = fn.project_id
          and p.user_id = auth.uid()
      )
      or fn.created_by = auth.uid()
    );
$$;
revoke all on function public.field_notes_list_deleted(uuid) from public;
grant execute on function public.field_notes_list_deleted(uuid) to authenticated;

-- Secure soft-delete helper: archive a note (is_deleted=true) with auth check
-- Only project owner or note creator can soft-delete
drop function if exists public.soft_delete_field_note(uuid);

create or replace function public.soft_delete_field_note(p_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.field_notes fn
  set is_deleted = true
  where fn.id = p_note_id
    and (
      exists (
        select 1
        from public.projects p
        where p.id = fn.project_id
          and p.user_id = auth.uid()
      )
      or fn.created_by = auth.uid()
    );

  if not found then
    raise exception 'not authorized to delete field note or note not found';
  end if;
end;
$$;

revoke all on function public.soft_delete_field_note(uuid) from public;
grant execute on function public.soft_delete_field_note(uuid) to authenticated;

-- -----------------------------------------
-- Storage policies for 'fieldnote-photos' bucket (user-scoped)
-- -----------------------------------------
insert into storage.buckets (id, name, public)
values ('fieldnote-photos', 'fieldnote-photos', true)
on conflict (id) do nothing;

-- Folder structure: <user_id>/<project_id>/<note_id>/<filename>
drop policy if exists "user read own folder (fieldnote-photos)"   on storage.objects;
drop policy if exists "user insert own folder (fieldnote-photos)" on storage.objects;
drop policy if exists "user update own folder (fieldnote-photos)" on storage.objects;
drop policy if exists "user delete own folder (fieldnote-photos)" on storage.objects;

create policy "user read own folder (fieldnote-photos)"
on storage.objects for select
to authenticated
using (
  bucket_id = 'fieldnote-photos'
  and coalesce((storage.foldername(name))[1], '') = auth.uid()::text
);

create policy "user insert own folder (fieldnote-photos)"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'fieldnote-photos'
  and coalesce((storage.foldername(name))[1], '') = auth.uid()::text
);

create policy "user update own folder (fieldnote-photos)"
on storage.objects for update
to authenticated
using (
  bucket_id = 'fieldnote-photos'
  and coalesce((storage.foldername(name))[1], '') = auth.uid()::text
);

create policy "user delete own folder (fieldnote-photos)"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'fieldnote-photos'
  and coalesce((storage.foldername(name))[1], '') = auth.uid()::text
);

-- -----------------------------------------
-- Storage bucket + policies for 'project-overlays' bucket (org-shared)
-- -----------------------------------------
insert into storage.buckets (id, name, public)
values ('project-overlays', 'project-overlays', true)
on conflict (id) do nothing;

drop policy if exists "overlay_read_any (project-overlays)"   on storage.objects;
drop policy if exists "overlay_insert_any (project-overlays)" on storage.objects;
drop policy if exists "overlay_update_any (project-overlays)" on storage.objects;
drop policy if exists "overlay_delete_any (project-overlays)" on storage.objects;

create policy "overlay_read_any (project-overlays)"
on storage.objects for select
to authenticated
using (
  bucket_id = 'project-overlays'
);

create policy "overlay_insert_any (project-overlays)"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'project-overlays'
);

create policy "overlay_update_any (project-overlays)"
on storage.objects for update
to authenticated
using (
  bucket_id = 'project-overlays'
)
with check (
  bucket_id = 'project-overlays'
);

create policy "overlay_delete_any (project-overlays)"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'project-overlays'
);

-- =========================================
-- END
-- =========================================
