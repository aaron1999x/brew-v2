-- Verbatim copy of docs/phase-4-system-design.md §4 (lines 134-1116). Do not edit.

-- =====================================================================
-- 0. Extensions and enums
-- =====================================================================
create extension if not exists citext;

create type public.app_role          as enum ('member', 'moderator', 'admin');
create type public.experience_level  as enum ('beginner', 'enthusiast', 'advanced', 'professional', 'competitor');
create type public.gear_category     as enum ('brewer', 'filter', 'grinder', 'kettle', 'scale', 'water', 'other');
create type public.recipe_visibility as enum ('private', 'public');
create type public.brew_method       as enum ('pour_over', 'immersion', 'hybrid', 'aeropress', 'french_press', 'siphon', 'cold_brew', 'other');
create type public.roast_level       as enum ('light', 'medium_light', 'medium', 'medium_dark', 'dark');
create type public.bypass_timing     as enum ('none', 'before', 'after');
create type public.brew_source       as enum ('timer', 'manual');
create type public.tasted_temp       as enum ('hot', 'warm', 'cool');
create type public.report_target     as enum ('recipe', 'profile');
create type public.report_reason     as enum ('spam', 'offensive', 'impersonation', 'copied_without_credit', 'other');
create type public.report_status     as enum ('open', 'dismissed', 'actioned');
create type public.notification_type as enum ('verified', 'recipe_hidden', 'recipe_restored', 'recipe_copied', 'recipe_brewed');
create type public.mod_action        as enum ('hide', 'restore', 'suspend', 'unsuspend', 'verify', 'unverify', 'role_change', 'dismiss_report');

-- =====================================================================
-- 1. Generic helpers
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =====================================================================
-- 2. People
-- =====================================================================
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  handle            citext not null unique
                    check (handle ~ '^[a-z0-9_]{3,30}$'),
  handle_confirmed  boolean not null default true,   -- false for Google sign-ups until they pick one
  display_name      text not null check (char_length(display_name) between 1 and 60),
  bio               text check (char_length(bio) <= 300),
  avatar_path       text,
  experience_level  public.experience_level,
  favourite_gear    jsonb not null default '[]'::jsonb
                    check (jsonb_typeof(favourite_gear) = 'array'),  -- [{ "category": "grinder", "name": "Comandante C40" }]
  is_verified       boolean not null default false,  -- moderators only (guarded)
  verified_at       timestamptz,
  hidden_at         timestamptz,                     -- moderators only (guarded)
  hidden_reason     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create index profiles_verified_idx on public.profiles (id) where is_verified;

create table public.reserved_handles (handle citext primary key);
insert into public.reserved_handles (handle) values
  ('admin'), ('mod'), ('moderator'), ('api'), ('settings'), ('explore'), ('verified'),
  ('notices'), ('recipes'), ('brew'), ('brews'), ('saved'), ('home'), ('welcome'),
  ('login'), ('signup'), ('reset-password'), ('terms'), ('privacy'), ('help'),
  ('competitions'), ('about'), ('support'), ('app'), ('www');

create table public.handle_history (
  old_handle  citext primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  changed_at  timestamptz not null default now()
);

create table public.account_status (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  role             public.app_role not null default 'member',
  suspended_at     timestamptz,
  suspended_reason text,
  updated_at       timestamptz not null default now()
);
create trigger account_status_updated_at before update on public.account_status
  for each row execute function public.set_updated_at();

create table public.user_settings (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  temp_unit    text not null default 'c'  check (temp_unit in ('c', 'f')),
  weight_unit  text not null default 'g'  check (weight_unit in ('g', 'oz')),
  date_format  text not null default 'dmy' check (date_format in ('dmy', 'mdy', 'ymd')),
  time_format  text not null default '24h' check (time_format in ('12h', '24h')),
  time_zone    text not null default 'UTC',
  onboarding   jsonb not null default '{}'::jsonb,   -- which onboarding steps are done/dismissed
  updated_at   timestamptz not null default now()
);
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

-- Role/state helpers used by policies (security definer so policies can read account_status)
create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.account_status
    where user_id = auth.uid() and role in ('moderator', 'admin') and suspended_at is null
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.account_status
    where user_id = auth.uid() and role = 'admin' and suspended_at is null
  );
$$;

create or replace function public.is_suspended(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select suspended_at is not null from public.account_status where user_id = uid), false);
$$;

create or replace function public.email_is_verified(uid uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce((select email_confirmed_at is not null from auth.users where id = uid), false);
$$;

-- Create profile, status and settings when an auth user is created.
-- Sign-up passes handle and display_name in user metadata. Google sign-ups get a temporary handle.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted   citext := lower(coalesce(new.raw_user_meta_data->>'handle', ''));
  chosen   citext;
  confirmed boolean := true;
begin
  if wanted ~ '^[a-z0-9_]{3,30}$'
     and not exists (select 1 from public.reserved_handles where handle = wanted)
     and not exists (select 1 from public.profiles where handle = wanted)
     and not exists (select 1 from public.handle_history where old_handle = wanted) then
    chosen := wanted;
  else
    chosen := 'brewer_' || substr(replace(new.id::text, '-', ''), 1, 10);
    confirmed := false;
  end if;

  insert into public.profiles (id, handle, handle_confirmed, display_name)
  values (
    new.id, chosen, confirmed,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''),
             nullif(new.raw_user_meta_data->>'full_name', ''), 'Brewer')
  );
  insert into public.account_status (user_id) values (new.id);
  insert into public.user_settings (user_id, time_zone)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'time_zone', ''), 'UTC'));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Handle rules on change: reserved words, 90-day redirect history
create or replace function public.profiles_handle_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.handle is distinct from old.handle then
    if exists (select 1 from public.reserved_handles where handle = new.handle) then
      raise exception 'handle_reserved' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.handle_history
               where old_handle = new.handle and user_id <> new.id
                 and changed_at > now() - interval '90 days') then
      raise exception 'handle_recently_used' using errcode = 'P0001';
    end if;
    if old.handle_confirmed then
      insert into public.handle_history (old_handle, user_id) values (old.handle, new.id)
      on conflict (old_handle) do update set user_id = excluded.user_id, changed_at = now();
    end if;
    new.handle_confirmed := true;
  end if;
  return new;
end $$;
create trigger profiles_handle_guard before update of handle on public.profiles
  for each row execute function public.profiles_handle_guard();

-- Only moderators may change verified/hidden fields
create or replace function public.profiles_moderation_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.is_verified is distinct from old.is_verified
      or new.verified_at is distinct from old.verified_at
      or new.hidden_at is distinct from old.hidden_at
      or new.hidden_reason is distinct from old.hidden_reason)
     and not public.is_moderator() then
    raise exception 'moderator_only' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_moderation_guard before update on public.profiles
  for each row execute function public.profiles_moderation_guard();

-- =====================================================================
-- 3. Gear
-- =====================================================================
create table public.gear_catalog (
  id        uuid primary key default gen_random_uuid(),
  category  public.gear_category not null,
  brand     text not null,
  model     text not null,
  name      text generated always as (brand || ' ' || model) stored,
  is_active boolean not null default true,
  unique (category, brand, model)
);

create table public.gear_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  category    public.gear_category not null,
  catalog_id  uuid references public.gear_catalog(id) on delete set null,
  custom_name text check (char_length(custom_name) <= 80),
  nickname    text check (char_length(nickname) <= 40),
  notes       text check (char_length(notes) <= 500),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (catalog_id is not null or custom_name is not null)
);
create unique index gear_one_default_per_category
  on public.gear_items (user_id, category) where is_default;
create index gear_items_user_idx on public.gear_items (user_id);
create trigger gear_items_updated_at before update on public.gear_items
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 4. Recipes and versions
-- =====================================================================
create table public.recipes (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references public.profiles(id) on delete cascade,
  slug                  text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 90),
  name                  text not null check (char_length(name) between 1 and 80),
  method                public.brew_method not null,
  method_custom         text check (char_length(method_custom) <= 40),
  visibility            public.recipe_visibility not null default 'private',
  published_at          timestamptz,
  hidden_at             timestamptz,               -- moderators only (guarded)
  hidden_reason         text,
  archived_at           timestamptz,
  deleted_at            timestamptz,
  latest_version_id     uuid,                      -- FK added after recipe_versions
  latest_version_no     int not null default 0,
  is_copy               boolean not null default false,
  forked_from_recipe_id  uuid references public.recipes(id) on delete set null,
  forked_from_version_id uuid,                     -- FK added after recipe_versions
  forked_from_owner_id   uuid references public.profiles(id) on delete set null,
  forked_from_version_no int,
  last_brewed_at        timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (owner_id, slug)
);
create index recipes_owner_idx on public.recipes (owner_id);
create index recipes_public_idx on public.recipes (published_at desc)
  where visibility = 'public' and hidden_at is null and archived_at is null and deleted_at is null;
create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

create table public.recipe_versions (
  id                 uuid primary key default gen_random_uuid(),
  recipe_id          uuid not null references public.recipes(id) on delete cascade,
  version_no         int not null check (version_no >= 1),
  change_note        text check (char_length(change_note) <= 200),
  -- coffee
  coffee_name        text check (char_length(coffee_name) <= 80),
  roaster            text check (char_length(roaster) <= 80),
  origin             text check (char_length(origin) <= 80),
  process            text check (char_length(process) <= 60),
  varietal           text check (char_length(varietal) <= 80),
  altitude_m         int  check (altitude_m between 0 and 4000),
  roast_level        public.roast_level,
  roast_date         date,
  colour_reading     numeric(6,1),
  colour_scale       text check (char_length(colour_scale) <= 30),   -- e.g. 'Agtron', 'Lighttells'
  -- gear (snapshot of names) + filter columns
  gear               jsonb not null default '{}'::jsonb check (jsonb_typeof(gear) = 'object'),
                     -- { "brewer": {"item_id": "...", "name": "Hario V60 02"}, "filter": {...}, "grinder": {...}, "kettle": {...}, "scale": {...}, "water": {...} }
  brewer_catalog_id  uuid references public.gear_catalog(id) on delete set null,
  grinder_catalog_id uuid references public.gear_catalog(id) on delete set null,
  -- numbers (metric)
  dose_g             numeric(5,1) not null check (dose_g > 0 and dose_g <= 200),
  brew_water_g       numeric(6,1) not null check (brew_water_g > 0 and brew_water_g <= 3000),
  bypass_g           numeric(6,1) not null default 0 check (bypass_g >= 0 and bypass_g <= 3000),
  bypass_timing      public.bypass_timing not null default 'none',
  retention_ratio    numeric(3,1) check (retention_ratio between 0 and 5),  -- g of water retained per g of coffee; null = default 2.0 in app
  temp_c             numeric(4,1) check (temp_c between 0 and 100),
  grind_setting      text check (char_length(grind_setting) <= 40),
  grind_microns      int  check (grind_microns between 50 and 2000),
  water_ppm          int  check (water_ppm between 0 and 1000),
  -- targets
  drawdown_min_s     int check (drawdown_min_s >= 0),
  drawdown_max_s     int check (drawdown_max_s >= 0),
  tds_min            numeric(4,2) check (tds_min between 0 and 20),
  tds_max            numeric(4,2) check (tds_max between 0 and 20),
  ey_min             numeric(4,1) check (ey_min between 0 and 40),
  ey_max             numeric(4,1) check (ey_max between 0 and 40),
  -- steps
  steps_schema       int not null default 1,
  steps              jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  notes              text check (char_length(notes) <= 5000),
  locked_at          timestamptz,     -- set when the first brew references this version
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (recipe_id, version_no)
);
create index recipe_versions_recipe_idx on public.recipe_versions (recipe_id, version_no desc);
create trigger recipe_versions_updated_at before update on public.recipe_versions
  for each row execute function public.set_updated_at();

alter table public.recipes
  add constraint recipes_latest_version_fk
    foreign key (latest_version_id) references public.recipe_versions(id) on delete set null,
  add constraint recipes_forked_from_version_fk
    foreign key (forked_from_version_id) references public.recipe_versions(id) on delete set null;

-- A version with brews can only change notes / change_note
create or replace function public.recipe_versions_lock_guard()
returns trigger language plpgsql as $$
begin
  if old.locked_at is not null then
    if (to_jsonb(new) - array['notes', 'change_note', 'updated_at'])
       is distinct from (to_jsonb(old) - array['notes', 'change_note', 'updated_at']) then
      raise exception 'version_locked' using errcode = 'P0001',
        hint = 'This version has brews. Save your changes as a new version.';
    end if;
  end if;
  return new;
end $$;
create trigger recipe_versions_lock_guard before update on public.recipe_versions
  for each row execute function public.recipe_versions_lock_guard();

-- Recipe visibility helper used by policies
create or replace function public.recipe_is_public(r_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.recipes r
    join public.profiles p on p.id = r.owner_id
    where r.id = r_id
      and r.visibility = 'public'
      and r.hidden_at is null and r.archived_at is null and r.deleted_at is null
      and p.hidden_at is null
      and not public.is_suspended(r.owner_id)
  );
$$;

-- Only moderators may hide/restore; publishing needs a verified email and respects the new-account limit
create table public.publish_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  recipe_id  uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index publish_log_user_idx on public.publish_log (user_id, created_at desc);

create or replace function public.recipes_guard()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  account_age interval;
  published_today int;
begin
  if (new.hidden_at is distinct from old.hidden_at or new.hidden_reason is distinct from old.hidden_reason)
     and not public.is_moderator() then
    raise exception 'moderator_only' using errcode = '42501';
  end if;

  if new.slug is distinct from old.slug or new.owner_id is distinct from old.owner_id
     or new.is_copy is distinct from old.is_copy
     or new.forked_from_version_id is distinct from old.forked_from_version_id then
    raise exception 'immutable_field' using errcode = 'P0001';
  end if;

  if new.visibility = 'public' and old.visibility = 'private' then
    if not public.email_is_verified(new.owner_id) then
      raise exception 'email_not_verified' using errcode = 'P0001';
    end if;
    select now() - created_at into account_age from auth.users where id = new.owner_id;
    if account_age < interval '7 days' then
      select count(*) into published_today from public.publish_log
      where user_id = new.owner_id and created_at > now() - interval '24 hours';
      if published_today >= 5 then
        raise exception 'publish_limit' using errcode = 'P0001',
          hint = 'New accounts can publish 5 recipes a day.';
      end if;
    end if;
    new.published_at := coalesce(new.published_at, now());
    insert into public.publish_log (user_id, recipe_id) values (new.owner_id, new.id);
  end if;
  return new;
end $$;
create trigger recipes_guard before update on public.recipes
  for each row execute function public.recipes_guard();

-- Public counters (brew logs stay private)
create table public.recipe_counters (
  recipe_id          uuid primary key references public.recipes(id) on delete cascade,
  owner_brews        int not null default 0,
  brewed_by_others   int not null default 0,   -- distinct other users
  copies             int not null default 0,
  saves              int not null default 0,
  updated_at         timestamptz not null default now()
);

-- =====================================================================
-- 5. Brews (always private)
-- =====================================================================
create table public.brews (
  id                    uuid primary key,          -- generated on the device (offline-safe, idempotent)
  user_id               uuid not null references public.profiles(id) on delete cascade,
  recipe_version_id     uuid references public.recipe_versions(id) on delete set null,
  recipe_id             uuid references public.recipes(id) on delete set null,
  -- snapshot so the log still reads correctly if the recipe disappears
  recipe_name_snapshot  text not null,
  author_handle_snapshot text,
  version_no_snapshot   int not null,
  dose_g_snapshot       numeric(5,1) not null,
  is_others_recipe      boolean not null default false,
  brewed_at             timestamptz not null,
  source                public.brew_source not null default 'manual',
  -- results
  drawdown_s            int check (drawdown_s >= 0 and drawdown_s <= 7200),
  beverage_g            numeric(6,1) check (beverage_g >= 0 and beverage_g <= 3000),
  tds_pct               numeric(4,2) check (tds_pct >= 0 and tds_pct <= 20),
  ey_pct                numeric(4,1),              -- computed by trigger
  -- sensory 0–10 in 0.5 steps
  sweetness             numeric(3,1) check (sweetness  between 0 and 10 and sweetness  * 2 = floor(sweetness  * 2)),
  acidity               numeric(3,1) check (acidity    between 0 and 10 and acidity    * 2 = floor(acidity    * 2)),
  brightness            numeric(3,1) check (brightness between 0 and 10 and brightness * 2 = floor(brightness * 2)),
  body                  numeric(3,1) check (body       between 0 and 10 and body       * 2 = floor(body       * 2)),
  clarity               numeric(3,1) check (clarity    between 0 and 10 and clarity    * 2 = floor(clarity    * 2)),
  balance               numeric(3,1) check (balance    between 0 and 10 and balance    * 2 = floor(balance    * 2)),
  aftertaste            numeric(3,1) check (aftertaste between 0 and 10 and aftertaste * 2 = floor(aftertaste * 2)),
  overall               numeric(3,1) not null check (overall between 0 and 10 and overall * 2 = floor(overall * 2)),
  flavours              text[] not null default '{}',
  tasted_temp           public.tasted_temp,
  tasted_after_min      int check (tasted_after_min between 0 and 240),
  notes                 text check (char_length(notes) <= 5000),
  next_change           text check (char_length(next_change) <= 1000),
  client_updated_at     timestamptz,               -- informational only
  deleted_at            timestamptz,               -- tombstone for sync, purged after 30 days
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index brews_user_time_idx    on public.brews (user_id, brewed_at desc) where deleted_at is null;
create index brews_user_sync_idx    on public.brews (user_id, updated_at);
create index brews_version_idx      on public.brews (recipe_version_id);
create index brews_recipe_idx       on public.brews (recipe_id);
create trigger brews_updated_at before update on public.brews
  for each row execute function public.set_updated_at();

-- Fill snapshots + EY on insert/update; check the version is brewable by this user
create or replace function public.brews_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v   public.recipe_versions;
  r   public.recipes;
  p   public.profiles;
begin
  if tg_op = 'UPDATE' and new.recipe_version_id is distinct from old.recipe_version_id then
    raise exception 'brew_version_immutable' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    select * into v from public.recipe_versions where id = new.recipe_version_id;
    if not found then raise exception 'version_not_found' using errcode = 'P0001'; end if;
    select * into r from public.recipes where id = v.recipe_id;
    if r.owner_id <> new.user_id and not public.recipe_is_public(r.id) then
      raise exception 'recipe_not_available' using errcode = '42501';
    end if;
    select * into p from public.profiles where id = r.owner_id;
    new.recipe_id              := r.id;
    new.recipe_name_snapshot   := r.name;
    new.author_handle_snapshot := p.handle;
    new.version_no_snapshot    := v.version_no;
    new.dose_g_snapshot        := v.dose_g;
    new.is_others_recipe       := (r.owner_id <> new.user_id);
  end if;

  if new.tds_pct is not null and new.beverage_g is not null and new.dose_g_snapshot > 0 then
    new.ey_pct := round((new.tds_pct * new.beverage_g / new.dose_g_snapshot)::numeric, 1);
  else
    new.ey_pct := null;
  end if;
  return new;
end $$;
create trigger brews_before_write before insert or update on public.brews
  for each row execute function public.brews_before_write();

-- After insert: lock version, update counters, last brewed, notify author
create or replace function public.brews_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  first_by_user boolean;
begin
  if new.recipe_version_id is null then return new; end if;

  update public.recipe_versions set locked_at = coalesce(locked_at, now())
  where id = new.recipe_version_id;

  select owner_id into owner from public.recipes where id = new.recipe_id;

  insert into public.recipe_counters (recipe_id) values (new.recipe_id)
  on conflict (recipe_id) do nothing;

  if owner = new.user_id then
    update public.recipe_counters set owner_brews = owner_brews + 1, updated_at = now()
    where recipe_id = new.recipe_id;
    update public.recipes set last_brewed_at = greatest(coalesce(last_brewed_at, new.brewed_at), new.brewed_at)
    where id = new.recipe_id;
  else
    select not exists (
      select 1 from public.brews
      where recipe_id = new.recipe_id and user_id = new.user_id and id <> new.id
    ) into first_by_user;
    if first_by_user then
      update public.recipe_counters set brewed_by_others = brewed_by_others + 1, updated_at = now()
      where recipe_id = new.recipe_id;
    end if;
    -- one notice per recipe per day per brewer
    insert into public.notifications (user_id, type, actor_id, recipe_id)
    select owner, 'recipe_brewed', new.user_id, new.recipe_id
    where not exists (
      select 1 from public.notifications
      where user_id = owner and type = 'recipe_brewed' and actor_id = new.user_id
        and recipe_id = new.recipe_id and created_at > now() - interval '1 day'
    );
  end if;
  return new;
end $$;

-- =====================================================================
-- 6. Social basics, moderation, notifications, events
-- =====================================================================
create table public.saved_recipes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  recipe_id  uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type public.report_target not null,
  target_id   uuid not null,
  reason      public.report_reason not null,
  details     text check (char_length(details) <= 1000),
  status      public.report_status not null default 'open',
  handled_by  uuid references public.profiles(id) on delete set null,
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index reports_open_idx on public.reports (created_at) where status = 'open';
create unique index reports_one_open_per_reporter
  on public.reports (reporter_id, target_type, target_id) where status = 'open';

create table public.moderation_actions (
  id           bigint generated always as identity primary key,
  moderator_id uuid references public.profiles(id) on delete set null,
  action       public.mod_action not null,
  target_type  text not null,
  target_id    uuid not null,
  reason       text,
  created_at   timestamptz not null default now()
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       public.notification_type not null,
  actor_id   uuid references public.profiles(id) on delete set null,
  recipe_id  uuid references public.recipes(id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,   -- e.g. { "reason": "..." }
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create trigger brews_after_insert after insert on public.brews
  for each row execute function public.brews_after_insert();

create table public.events (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles(id) on delete set null,
  anon_id    text check (char_length(anon_id) <= 64),
  name       text not null check (name in (
               'timer_started', 'timer_completed', 'timer_abandoned',
               'share_link_opened', 'signup_from_share', 'pwa_installed', 'sync_failed')),
  recipe_id  uuid references public.recipes(id) on delete set null,
  props      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index events_name_time_idx on public.events (name, created_at);

-- =====================================================================
-- 7. Row-level security
-- =====================================================================
alter table public.profiles           enable row level security;
alter table public.reserved_handles   enable row level security;
alter table public.handle_history     enable row level security;
alter table public.account_status     enable row level security;
alter table public.user_settings      enable row level security;
alter table public.gear_catalog       enable row level security;
alter table public.gear_items         enable row level security;
alter table public.recipes            enable row level security;
alter table public.recipe_versions    enable row level security;
alter table public.recipe_counters    enable row level security;
alter table public.publish_log        enable row level security;
alter table public.brews              enable row level security;
alter table public.saved_recipes      enable row level security;
alter table public.reports            enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.notifications      enable row level security;
alter table public.events             enable row level security;

-- profiles: public unless hidden or suspended; owner always; moderators always
create policy profiles_select on public.profiles for select using (
  (hidden_at is null and not public.is_suspended(id))
  or id = (select auth.uid())
  or public.is_moderator()
);
create policy profiles_update_own on public.profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_update_mod on public.profiles for update
  using (public.is_moderator()) with check (public.is_moderator());

create policy reserved_handles_select on public.reserved_handles for select using (true);
create policy handle_history_select   on public.handle_history   for select using (true);

-- account_status: read own; moderators read all; writes only via moderator RPCs (security definer)
create policy account_status_select on public.account_status for select
  using (user_id = (select auth.uid()) or public.is_moderator());

-- user_settings: owner only
create policy user_settings_all on public.user_settings for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- gear catalog: everyone reads; admins write
create policy gear_catalog_select on public.gear_catalog for select using (true);
create policy gear_catalog_admin  on public.gear_catalog for all using (public.is_admin()) with check (public.is_admin());

-- gear items: owner only
create policy gear_items_all on public.gear_items for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- recipes
create policy recipes_select on public.recipes for select using (
  owner_id = (select auth.uid())
  or public.recipe_is_public(id)
  or public.is_moderator()
);
create policy recipes_insert on public.recipes for insert
  with check (owner_id = (select auth.uid()) and visibility = 'private' and not public.is_suspended((select auth.uid())));
create policy recipes_update_own on public.recipes for update
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy recipes_update_mod on public.recipes for update
  using (public.is_moderator()) with check (public.is_moderator());
-- no delete policy: deletion is soft (deleted_at) through update

-- recipe versions follow their recipe
create policy recipe_versions_select on public.recipe_versions for select using (
  exists (select 1 from public.recipes r where r.id = recipe_id
          and (r.owner_id = (select auth.uid()) or public.recipe_is_public(r.id) or public.is_moderator()))
);
create policy recipe_versions_insert on public.recipe_versions for insert with check (
  exists (select 1 from public.recipes r where r.id = recipe_id and r.owner_id = (select auth.uid()) and r.deleted_at is null)
);
create policy recipe_versions_update on public.recipe_versions for update
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.owner_id = (select auth.uid())));

-- counters: visible with the recipe; written only by triggers
create policy recipe_counters_select on public.recipe_counters for select using (
  exists (select 1 from public.recipes r where r.id = recipe_id
          and (r.owner_id = (select auth.uid()) or public.recipe_is_public(r.id)))
);

-- publish log: no client access (trigger only)

-- brews: owner only, always
create policy brews_select on public.brews for select using (user_id = (select auth.uid()));
create policy brews_insert on public.brews for insert
  with check (user_id = (select auth.uid()) and not public.is_suspended((select auth.uid())));
create policy brews_update on public.brews for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- deletes are tombstones (deleted_at) through update

-- saved recipes: owner only; can only save recipes that are public
create policy saved_select on public.saved_recipes for select using (user_id = (select auth.uid()));
create policy saved_insert on public.saved_recipes for insert
  with check (user_id = (select auth.uid()) and public.recipe_is_public(recipe_id));
create policy saved_delete on public.saved_recipes for delete using (user_id = (select auth.uid()));

-- reports: logged-in users file; reporters see their own; moderators see and update all
create policy reports_insert on public.reports for insert
  with check (reporter_id = (select auth.uid()) and status = 'open');
create policy reports_select on public.reports for select
  using (reporter_id = (select auth.uid()) or public.is_moderator());
create policy reports_update_mod on public.reports for update
  using (public.is_moderator()) with check (public.is_moderator());

-- moderation log: moderators read; written by RPCs
create policy moderation_actions_select on public.moderation_actions for select using (public.is_moderator());

-- notifications: owner reads and marks read; created by triggers/RPCs
create policy notifications_select on public.notifications for select using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- events: inserted via the log_event RPC; admins read
create policy events_select_admin on public.events for select using (public.is_admin());

-- =====================================================================
-- 8. RPC functions (called with supabase.rpc)
-- =====================================================================

-- Slug from a name, unique per owner
create or replace function public.make_slug(p_owner uuid, p_name text)
returns text language plpgsql stable set search_path = public as $$
declare
  base text := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  candidate text;
  n int := 1;
begin
  if base = '' then base := 'recipe'; end if;
  base := left(base, 80);
  candidate := base;
  while exists (select 1 from public.recipes where owner_id = p_owner and slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end $$;

-- Create recipe + v1 in one call. p_version is a JSON object with version columns.
create or replace function public.create_recipe(p_name text, p_method public.brew_method, p_method_custom text, p_version jsonb)
returns public.recipes language plpgsql security invoker set search_path = public as $$
declare
  rec public.recipes;
  ver public.recipe_versions;
begin
  insert into public.recipes (owner_id, slug, name, method, method_custom)
  values (auth.uid(), public.make_slug(auth.uid(), p_name), p_name, p_method, p_method_custom)
  returning * into rec;

  ver := jsonb_populate_record(null::public.recipe_versions, p_version);
  insert into public.recipe_versions (
    recipe_id, version_no, change_note, coffee_name, roaster, origin, process, varietal, altitude_m,
    roast_level, roast_date, colour_reading, colour_scale, gear, brewer_catalog_id, grinder_catalog_id,
    dose_g, brew_water_g, bypass_g, bypass_timing, retention_ratio, temp_c, grind_setting, grind_microns,
    water_ppm, drawdown_min_s, drawdown_max_s, tds_min, tds_max, ey_min, ey_max, steps_schema, steps, notes)
  values (
    rec.id, 1, ver.change_note, ver.coffee_name, ver.roaster, ver.origin, ver.process, ver.varietal, ver.altitude_m,
    ver.roast_level, ver.roast_date, ver.colour_reading, ver.colour_scale, coalesce(ver.gear, '{}'::jsonb),
    ver.brewer_catalog_id, ver.grinder_catalog_id, ver.dose_g, ver.brew_water_g, coalesce(ver.bypass_g, 0),
    coalesce(ver.bypass_timing, 'none'), ver.retention_ratio, ver.temp_c, ver.grind_setting, ver.grind_microns,
    ver.water_ppm, ver.drawdown_min_s, ver.drawdown_max_s, ver.tds_min, ver.tds_max, ver.ey_min, ver.ey_max,
    coalesce(ver.steps_schema, 1), coalesce(ver.steps, '[]'::jsonb), ver.notes)
  returning * into ver;

  insert into public.recipe_counters (recipe_id) values (rec.id);
  update public.recipes set latest_version_id = ver.id, latest_version_no = 1 where id = rec.id
  returning * into rec;
  return rec;
end $$;

-- Save the next version of an owned recipe
create or replace function public.create_version(p_recipe_id uuid, p_version jsonb)
returns public.recipe_versions language plpgsql security invoker set search_path = public as $$
declare
  rec public.recipes;
  ver public.recipe_versions;
begin
  select * into rec from public.recipes where id = p_recipe_id and owner_id = auth.uid() for update;
  if not found then raise exception 'recipe_not_found' using errcode = 'P0001'; end if;

  ver := jsonb_populate_record(null::public.recipe_versions, p_version);
  insert into public.recipe_versions (
    recipe_id, version_no, change_note, coffee_name, roaster, origin, process, varietal, altitude_m,
    roast_level, roast_date, colour_reading, colour_scale, gear, brewer_catalog_id, grinder_catalog_id,
    dose_g, brew_water_g, bypass_g, bypass_timing, retention_ratio, temp_c, grind_setting, grind_microns,
    water_ppm, drawdown_min_s, drawdown_max_s, tds_min, tds_max, ey_min, ey_max, steps_schema, steps, notes)
  values (
    rec.id, rec.latest_version_no + 1, ver.change_note, ver.coffee_name, ver.roaster, ver.origin, ver.process,
    ver.varietal, ver.altitude_m, ver.roast_level, ver.roast_date, ver.colour_reading, ver.colour_scale,
    coalesce(ver.gear, '{}'::jsonb), ver.brewer_catalog_id, ver.grinder_catalog_id, ver.dose_g, ver.brew_water_g,
    coalesce(ver.bypass_g, 0), coalesce(ver.bypass_timing, 'none'), ver.retention_ratio, ver.temp_c,
    ver.grind_setting, ver.grind_microns, ver.water_ppm, ver.drawdown_min_s, ver.drawdown_max_s, ver.tds_min,
    ver.tds_max, ver.ey_min, ver.ey_max, coalesce(ver.steps_schema, 1), coalesce(ver.steps, '[]'::jsonb), ver.notes)
  returning * into ver;

  update public.recipes set latest_version_id = ver.id, latest_version_no = ver.version_no where id = rec.id;
  return ver;
end $$;

-- Copy a public recipe version into my recipes, with credit
create or replace function public.copy_recipe(p_version_id uuid)
returns public.recipes language plpgsql security definer set search_path = public as $$
declare
  src_v public.recipe_versions;
  src_r public.recipes;
  rec   public.recipes;
  ver   public.recipe_versions;
  me    uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into src_v from public.recipe_versions where id = p_version_id;
  select * into src_r from public.recipes where id = src_v.recipe_id;
  if src_r.id is null or (src_r.owner_id <> me and not public.recipe_is_public(src_r.id)) then
    raise exception 'recipe_not_available' using errcode = '42501';
  end if;

  insert into public.recipes (owner_id, slug, name, method, method_custom, is_copy,
                              forked_from_recipe_id, forked_from_version_id, forked_from_owner_id, forked_from_version_no)
  values (me, public.make_slug(me, src_r.name), src_r.name, src_r.method, src_r.method_custom, true,
          src_r.id, src_v.id, src_r.owner_id, src_v.version_no)
  returning * into rec;

  insert into public.recipe_versions (
    recipe_id, version_no, change_note, coffee_name, roaster, origin, process, varietal, altitude_m,
    roast_level, roast_date, colour_reading, colour_scale, gear, brewer_catalog_id, grinder_catalog_id,
    dose_g, brew_water_g, bypass_g, bypass_timing, retention_ratio, temp_c, grind_setting, grind_microns,
    water_ppm, drawdown_min_s, drawdown_max_s, tds_min, tds_max, ey_min, ey_max, steps_schema, steps, notes)
  select rec.id, 1, 'Copied from v' || src_v.version_no, coffee_name, roaster, origin, process, varietal, altitude_m,
    roast_level, roast_date, colour_reading, colour_scale, gear, brewer_catalog_id, grinder_catalog_id,
    dose_g, brew_water_g, bypass_g, bypass_timing, retention_ratio, temp_c, grind_setting, grind_microns,
    water_ppm, drawdown_min_s, drawdown_max_s, tds_min, tds_max, ey_min, ey_max, steps_schema, steps, notes
  from public.recipe_versions where id = src_v.id
  returning * into ver;

  insert into public.recipe_counters (recipe_id) values (rec.id);
  update public.recipes set latest_version_id = ver.id, latest_version_no = 1 where id = rec.id returning * into rec;

  if src_r.owner_id <> me then
    insert into public.recipe_counters (recipe_id) values (src_r.id) on conflict do nothing;
    update public.recipe_counters set copies = copies + 1, updated_at = now() where recipe_id = src_r.id;
    insert into public.notifications (user_id, type, actor_id, recipe_id)
    values (src_r.owner_id, 'recipe_copied', me, src_r.id);
  end if;
  return rec;
end $$;

-- Save / unsave keep the counter in step
create or replace function public.saved_recipes_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.recipe_counters (recipe_id) values (new.recipe_id) on conflict do nothing;
    update public.recipe_counters set saves = saves + 1, updated_at = now() where recipe_id = new.recipe_id;
  else
    update public.recipe_counters set saves = greatest(saves - 1, 0), updated_at = now() where recipe_id = old.recipe_id;
  end if;
  return null;
end $$;
create trigger saved_recipes_count after insert or delete on public.saved_recipes
  for each row execute function public.saved_recipes_count();

-- Moderator actions
create or replace function public.mod_set_recipe_hidden(p_recipe_id uuid, p_hidden boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if not public.is_moderator() then raise exception 'moderator_only' using errcode = '42501'; end if;
  update public.recipes
     set hidden_at = case when p_hidden then now() else null end,
         hidden_reason = case when p_hidden then p_reason else null end
   where id = p_recipe_id
  returning owner_id into owner;
  insert into public.moderation_actions (moderator_id, action, target_type, target_id, reason)
  values (auth.uid(), case when p_hidden then 'hide'::public.mod_action else 'restore'::public.mod_action end,
          'recipe', p_recipe_id, p_reason);
  insert into public.notifications (user_id, type, actor_id, recipe_id, payload)
  values (owner, case when p_hidden then 'recipe_hidden'::public.notification_type else 'recipe_restored'::public.notification_type end,
          null, p_recipe_id, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.mod_set_verified(p_user_id uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'moderator_only' using errcode = '42501'; end if;
  update public.profiles
     set is_verified = p_verified, verified_at = case when p_verified then now() else null end
   where id = p_user_id;
  insert into public.moderation_actions (moderator_id, action, target_type, target_id)
  values (auth.uid(), case when p_verified then 'verify'::public.mod_action else 'unverify'::public.mod_action end,
          'profile', p_user_id);
  if p_verified then
    insert into public.notifications (user_id, type) values (p_user_id, 'verified');
  end if;
end $$;

create or replace function public.mod_set_suspended(p_user_id uuid, p_suspended boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'moderator_only' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot_suspend_self' using errcode = 'P0001'; end if;
  update public.account_status
     set suspended_at = case when p_suspended then now() else null end,
         suspended_reason = case when p_suspended then p_reason else null end
   where user_id = p_user_id;
  insert into public.moderation_actions (moderator_id, action, target_type, target_id, reason)
  values (auth.uid(), case when p_suspended then 'suspend'::public.mod_action else 'unsuspend'::public.mod_action end,
          'profile', p_user_id, p_reason);
end $$;

create or replace function public.admin_set_role(p_user_id uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_only' using errcode = '42501'; end if;
  update public.account_status set role = p_role where user_id = p_user_id;
  insert into public.moderation_actions (moderator_id, action, target_type, target_id, reason)
  values (auth.uid(), 'role_change', 'profile', p_user_id, p_role::text);
end $$;

create or replace function public.mod_resolve_report(p_report_id uuid, p_status public.report_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'moderator_only' using errcode = '42501'; end if;
  update public.reports set status = p_status, handled_by = auth.uid(), handled_at = now() where id = p_report_id;
  insert into public.moderation_actions (moderator_id, action, target_type, target_id)
  values (auth.uid(), 'dismiss_report', 'report', p_report_id);
end $$;

-- Verified feed (public, paged by published_at)
create or replace function public.verified_recipes(p_method public.brew_method default null,
                                                   p_before timestamptz default null,
                                                   p_limit int default 20)
returns table (recipe_id uuid, slug text, name text, method public.brew_method, published_at timestamptz,
               owner_handle citext, owner_name text, avatar_path text, latest_version_no int,
               brewed_by_others int, owner_brews int)
language sql stable security definer set search_path = public as $$
  select r.id, r.slug, r.name, r.method, r.published_at, p.handle, p.display_name, p.avatar_path,
         r.latest_version_no, coalesce(c.brewed_by_others, 0), coalesce(c.owner_brews, 0)
  from public.recipes r
  join public.profiles p on p.id = r.owner_id
  left join public.recipe_counters c on c.recipe_id = r.id
  where p.is_verified
    and public.recipe_is_public(r.id)
    and (p_method is null or r.method = p_method)
    and (p_before is null or r.published_at < p_before)
  order by r.published_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- Public profile stats (counts only)
create or replace function public.profile_stats(p_user_id uuid)
returns table (recipes int, public_recipes int, versions int, brews int, brewed_by_others int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.recipes where owner_id = p_user_id and deleted_at is null and archived_at is null)::int,
    (select count(*) from public.recipes r where r.owner_id = p_user_id and public.recipe_is_public(r.id))::int,
    (select count(*) from public.recipe_versions v join public.recipes r on r.id = v.recipe_id
       where r.owner_id = p_user_id and r.deleted_at is null)::int,
    (select count(*) from public.brews where user_id = p_user_id and deleted_at is null)::int,
    (select count(distinct b.user_id) from public.brews b join public.recipes r on r.id = b.recipe_id
       where r.owner_id = p_user_id and b.user_id <> p_user_id and b.deleted_at is null
         and public.recipe_is_public(r.id))::int
  where exists (select 1 from public.profiles where id = p_user_id and hidden_at is null)
    and not public.is_suspended(p_user_id);
$$;

-- Product events (rate-limited, whitelist enforced by check constraint)
create or replace function public.log_event(p_name text, p_recipe_id uuid default null,
                                            p_props jsonb default '{}'::jsonb, p_anon_id text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.events
      where coalesce(user_id::text, anon_id) = coalesce(auth.uid()::text, p_anon_id)
        and created_at > now() - interval '1 minute') >= 30 then
    return;  -- silently drop floods
  end if;
  insert into public.events (user_id, anon_id, name, recipe_id, props)
  values (auth.uid(), case when auth.uid() is null then p_anon_id end, p_name, p_recipe_id, coalesce(p_props, '{}'::jsonb));
end $$;

-- Grants: functions callable by signed-in users; a few by anonymous visitors
revoke all on function public.mod_set_recipe_hidden, public.mod_set_verified, public.mod_set_suspended,
  public.admin_set_role, public.mod_resolve_report from public, anon;
grant execute on function public.verified_recipes, public.profile_stats, public.log_event to anon, authenticated;
grant execute on function public.create_recipe, public.create_version, public.copy_recipe,
  public.mod_set_recipe_hidden, public.mod_set_verified, public.mod_set_suspended,
  public.admin_set_role, public.mod_resolve_report to authenticated;
