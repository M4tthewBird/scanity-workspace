-- Karty, zakázky, CRM, nápady a roadmapa. Spusťte jednou v SQL editoru po schema.sql.
-- Jen přidává, stávající data nemění. Reálný obsah patří do migration-002-data.sql (v .gitignore).

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  industry_id uuid references pages on delete set null,
  website text default '',
  notes text default '',
  created_by uuid references members(user_id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  company_id uuid references companies on delete set null,
  role text default '',
  email text default '',
  phone text default '',
  notes text default '',
  created_by uuid references members(user_id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Produkt, odvětví, zakázka i šablona jsou stránky, takže všechny mají sekce a úkoly.
alter table pages
  add column kind text not null default 'product' check (kind in ('product','industry','job','template')),
  add column stage text check (stage in ('poptavka','nabidka','realizace','predano','vyfakturovano')),
  add column price numeric,
  add column start_date date,
  add column due_date date,
  add column industry_id uuid references pages on delete set null,
  add column company_id uuid references companies on delete set null,
  add column contact_id uuid references contacts on delete set null,
  add column tags text[] not null default '{}';

create table ideas (
  id uuid primary key default gen_random_uuid(),
  text text not null default '',
  notes text default '',
  status text not null default 'new' check (status in ('new','considering','approved','rejected','done')),
  product_id uuid references pages on delete set null,
  tags text[] not null default '{}',
  created_by uuid references members(user_id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table milestones (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  product_id uuid references pages on delete set null,
  start_date date,
  end_date date,
  notes text default '',
  position double precision not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tasks
  add column milestone_id uuid references milestones on delete set null,
  add column tags text[] not null default '{}';

create table comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('task','job','idea','company','contact','milestone')),
  target_id uuid not null,
  body text not null default '',
  system boolean not null default false,
  author uuid references members(user_id) on delete set null,
  created_at timestamptz default now()
);
create index comments_target on comments (target_id);

alter table companies  enable row level security;
alter table contacts   enable row level security;
alter table ideas      enable row level security;
alter table milestones enable row level security;
alter table comments   enable row level security;

create policy "companies all"  on companies  for all using (is_member()) with check (is_member());
create policy "contacts all"   on contacts   for all using (is_member()) with check (is_member());
create policy "ideas all"      on ideas      for all using (is_member()) with check (is_member());
create policy "milestones all" on milestones for all using (is_member()) with check (is_member());
create policy "comments all"   on comments   for all using (is_member()) with check (is_member());

create trigger t_companies  before update on companies  for each row execute function touch();
create trigger t_contacts   before update on contacts   for each row execute function touch();
create trigger t_ideas      before update on ideas      for each row execute function touch();
create trigger t_milestones before update on milestones for each row execute function touch();

alter publication supabase_realtime add table companies, contacts, ideas, milestones, comments;
