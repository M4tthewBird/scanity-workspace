-- Archiv hotových projektů a meetingy s poznámkami přiřazenými k projektům.
-- Spusťte jednou po migration-005.sql. Jen přidává, stávající data nemění.

-- Stav Hotovo: projekt zmizí z Přehledu do archivu.
alter table pages drop constraint if exists pages_state_check;
alter table pages add constraint pages_state_check check (state in ('active','waiting','hot','paused','done'));

create table meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references members(user_id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Jeden bod zápisu. page_id přiřazuje bod k projektu (zakázce nebo produktu).
create table meeting_notes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings on delete cascade,
  page_id uuid references pages on delete set null,
  body text not null default '',
  position double precision not null default 0,
  created_by uuid references members(user_id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index meeting_notes_page on meeting_notes (page_id);

alter table meetings      enable row level security;
alter table meeting_notes enable row level security;

create policy "meetings all"      on meetings      for all using (is_member()) with check (is_member());
create policy "meeting_notes all" on meeting_notes for all using (is_member()) with check (is_member());

create trigger t_meetings      before update on meetings      for each row execute function touch();
create trigger t_meeting_notes before update on meeting_notes for each row execute function touch();

alter publication supabase_realtime add table meetings, meeting_notes;
