-- =========================================
-- bootstrap.sql — projects + field_notes
-- Soft-delete enforced, edit_history auto-diffs all changes
-- =========================================

create extension if not exists pgcrypto;

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

-- touch updated_at
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

-- RLS
alter table public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
drop policy if exists "projects_insert_self" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;

create policy "projects_select_own"
  on public.projects for select
  to authenticated
  using (user_id = auth.uid());

create policy "projects_insert_self"
  on public.projects for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "projects_update_own"
  on public.projects for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "projects_delete_own"
  on public.projects for delete
  to authenticated
  using (user_id = auth.uid());

create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_projects_status on public.projects(status);


-- -----------------------------------------
-- FIELD NOTES
-- -----------------------------------------
create table if not exists public.field_notes (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  created_by       uuid not null references auth.users(id) on delete cascade,
  created_by_name  text,
  project_name     text,

  latitude         double precision,
  longitude        double precision,

  asset_type       text not null default 'Unknown'
                   check (asset_type in ('Hand Hole','Vault','Pedestal','Flower Pot','MST','Unknown')),

  notes            text,
  photos           jsonb not null default '[]'::jsonb,

  is_deleted       boolean not null default false,

  edit_history     jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- normalize legacy typo
update public.field_notes
set asset_type = 'Unknown'
where asset_type is not null and asset_type ilike 'uknown';

-- indexes
create index if not exists idx_field_notes_project_id on public.field_notes(project_id);
create index if not exists idx_field_notes_created_by on public.field_notes(created_by);
create index if not exists idx_field_notes_created_at on public.field_notes(created_at);
create index if not exists idx_field_notes_is_deleted on public.field_notes(is_deleted);

-- updated_at touch
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
-- edit_history: generic diff of ALL non-audit columns
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
  oldj jsonb;
  newj jsonb;
  key text;
  diff jsonb := '{}'::jsonb;
  changed boolean := false;
  now_ts timestamptz := now();
  uid uuid := coalesce(auth.uid(), new.created_by);
  -- exclude audit/internal keys from diff
  ignore_keys text[] := array[
    'id','created_at','updated_at','edit_history'
  ];
begin
  oldj := to_jsonb(old) - ignore_keys;
  newj := to_jsonb(new) - ignore_keys;

  for key in
    select k from (
      select jsonb_object_keys(oldj) as k
      union
      select jsonb_object_keys(newj) as k
    ) s
  loop
    if (oldj -> key) is distinct from (newj -> key) then
      diff := diff || jsonb_build_object(
        key,
        jsonb_build_object(
          'old', oldj -> key,
          'new', newj -> key
        )
      );
      changed := true;
    end if;
  end loop;

  if changed then
    new.edit_history := coalesce(new.edit_history, '[]'::jsonb) ||
      jsonb_build_object(
        'changed_at', now_ts,
        'changed_by', uid,
        'diff', diff
      );
  end if;

  return new;
end$$;

create trigger trg_field_notes_history
before update on public.field_notes
for each row
execute function public.tfn_log_field_notes_history();

-- -----------------------------------------
-- RLS for FIELD NOTES (A: enforced soft-delete)
--   - No DELETE policy (so hard deletes are disallowed)
--   - SELECT hides is_deleted=true
--   - INSERT/UPDATE gated by project ownership or creator as noted
-- -----------------------------------------
alter table public.field_notes enable row level security;

drop policy if exists "field_notes_select_visible_project_owner_or_creator" on public.field_notes;
drop policy if exists "field_notes_insert_creator_project_owner" on public.field_notes;
drop policy if exists "field_notes_update_project_owner_or_creator" on public.field_notes;
-- NOTE: intentionally no DELETE policy => users cannot hard delete

-- Read: only non-deleted; project owner OR note creator
create policy "field_notes_select_visible_project_owner_or_creator"
  on public.field_notes for select
  to authenticated
  using (
    is_deleted = false
    and (
      exists (
        select 1 from public.projects p
        where p.id = field_notes.project_id
          and p.user_id = auth.uid()
      )
      or created_by = auth.uid()
    )
  );

-- Insert: creator must be the authed user AND must own the project
create policy "field_notes_insert_creator_project_owner"
  on public.field_notes for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  );

-- Update: project owner OR note creator
create policy "field_notes_update_project_owner_or_creator"
  on public.field_notes for update
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = field_notes.project_id
        and p.user_id = auth.uid()
    )
    or created_by = auth.uid()
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
    or created_by = auth.uid()
  );

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
      exists (select 1 from public.projects p where p.id = fn.project_id and p.user_id = auth.uid())
      or fn.created_by = auth.uid()
    );
$$;
revoke all on function public.field_notes_list_deleted(uuid) from public;
grant execute on function public.field_notes_list_deleted(uuid) to authenticated;


-- -----------------------------------------
-- OPTIONAL: Storage policies for 'fieldnote-photos' bucket
-- -----------------------------------------
drop policy if exists "public read fieldnote-photos" on storage.objects;
drop policy if exists "user upload own folder (fieldnote-photos)" on storage.objects;
drop policy if exists "user update own folder (fieldnote-photos)" on storage.objects;
drop policy if exists "user delete own folder (fieldnote-photos)" on storage.objects;

create policy "public read fieldnote-photos"
on storage.objects for select
to authenticated
using (bucket_id = 'fieldnote-photos');

create policy "user upload own folder (fieldnote-photos)"
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
)
with check (
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

-- =========================================
-- END
-- =========================================
