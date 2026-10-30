create table members (
  user_id uuid primary key references auth.users on delete cascade,
  name text not null,
  color text default '#246bfd'
);

create table pages (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Bez názvu',
  icon text default '📄',
  description text default '',
  position double precision not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages on delete cascade,
  title text not null default 'Nová sekce',
  position double precision not null default 0
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages on delete cascade,
  section_id uuid references sections on delete set null,
  text text not null default '',
  done boolean not null default false,
  priority text check (priority in ('P1','P2','P3')),
  assignee uuid references members(user_id) on delete set null,
  due date,
  notes text default '',
  position double precision not null default 0,
  created_by uuid references members(user_id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- jen členové týmu
create function is_member() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from members where user_id = auth.uid()) $$;

alter table members  enable row level security;
alter table pages    enable row level security;
alter table sections enable row level security;
alter table tasks    enable row level security;

create policy "members read"  on members  for select using (is_member());
create policy "pages all"     on pages    for all using (is_member()) with check (is_member());
create policy "sections all"  on sections for all using (is_member()) with check (is_member());
create policy "tasks all"     on tasks    for all using (is_member()) with check (is_member());

-- updated_at
create function touch() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;
create trigger t_pages before update on pages for each row execute function touch();
create trigger t_tasks before update on tasks for each row execute function touch();

-- realtime
alter publication supabase_realtime add table pages, sections, tasks;
