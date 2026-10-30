# Scanity Workspace – zadání pro Claude Code

Repo: https://github.com/M4tthewBird/scanity-workspace (veřejné)
Web: https://m4tthewbird.github.io/scanity-workspace/ (GitHub Pages)

Interní to-do / checklist appka pro tým Scanity ve stylu Notion: stránky v sidebaru, na stránce sekce a úkoly se zaškrtávátky. Používáme ji ve dvou až třech lidech a měníme ji za chodu.

---

## ⚠️ Zásadní pravidlo: veřejné repo = žádná data v repu

Repo je veřejné a GitHub Pages je jen statický hosting. Z toho plyne:

- **Login v čistém JavaScriptu (heslo v kódu, kontrola v prohlížeči) NIC nechrání.** Kdokoli si otevře zdroják nebo JSON v repu.
- Úkoly, jména klientů a poznámky proto **nesmí být v repu** (ani `tasks.json`, ani seed s reálnými daty).
- Data i přihlášení řeší externí backend. Zvolené řešení je **Supabase** (free tier): Postgres + Auth + Realtime.
- Do repa a do buildu smí jen `SUPABASE_URL` a `SUPABASE_ANON_KEY`. Anon key je veřejný z principu, data chrání **Row Level Security** v databázi. **Nikdy** do repa nedávat `service_role` key.

---

## Stack

- **Vite + React + TypeScript**, bez UI frameworku (vlastní CSS).
- `@supabase/supabase-js` pro auth, data a realtime.
- Routing přes **hash** (`#/page/<id>`), protože GitHub Pages neumí SPA fallback.
- `vite.config.ts`: `base: '/scanity-workspace/'`.
- Deploy přes **GitHub Actions** → GitHub Pages (`actions/deploy-pages`). Env `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY` z GitHub Secrets.
- Lokálně: `.env.local` (v `.gitignore`), `npm run dev`.

---

## Přihlášení

- Supabase Auth, **e-mail + heslo** (volitelně magic link).
- **Registrace vypnuté** (Supabase → Authentication → Sign In / Providers → Allow new users to sign up = off). Uživatele zakládám ručně přes „Invite user“.
- Navíc tabulka `members` jako allowlist: i přihlášený uživatel, který v ní není, nic neuvidí (RLS).
- Nepřihlášený uživatel vidí jen login obrazovku. Session drží supabase-js.
- V Supabase → Authentication → URL Configuration nastavit Site URL a Redirect URL na `https://m4tthewbird.github.io/scanity-workspace/` a `http://localhost:5173`.

---

## Datový model (Supabase SQL)

Uložit jako `supabase/schema.sql` a spustit v SQL editoru.

```sql
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
```

Po pozvání uživatele ho ručně přidat do `members` (`insert into members (user_id, name) values ('<uuid z auth.users>', 'Matyáš');`).

---

## Funkce MVP

**Layout**
- Sidebar: logo Scanity, „Přehled“, „Moje úkoly“, seznam stránek (emoji + název), „+ Nová stránka“, dole přihlášený uživatel + odhlásit.
- Na mobilu sidebar schovaný za ☰.

**Stránka**
- Emoji ikona (klik → výběr), název a popis editovatelné přímo na místě.
- Progress bar hotovo / celkem.
- Filtry: Vše / Otevřené / Moje.
- Sekce s editovatelným nadpisem, počtem hotových, mazáním; „+ Nová sekce“.

**Úkol (řádek)**
- Zaškrtávátko, text editovatelný inline.
- `Enter` = nový úkol pod aktuálním, `Backspace` v prázdném = smazat a skočit na předchozí, šipky ↑/↓ = pohyb mezi úkoly.
- Štítky: priorita (P1 červená / P2 oranžová / P3 šedá, klik cykluje), přiřazený člověk (barevné kolečko s iniciálou), termín (po termínu červeně).
- Drag & drop přes úchyt ⋮⋮ – pořadí i přesun mezi sekcemi (`position` jako float uprostřed sousedů).
- Klik na ↗ otevře boční panel: text, stránka, sekce, priorita, přiřazení, termín, poznámky (víceřádkové), kdo a kdy vytvořil, smazat.

**Přehledy**
- „Přehled“: všechny otevřené úkoly seskupené podle priority, u každého štítek stránky (klik = přechod).
- „Moje úkoly“: otevřené úkoly přiřazené mně, seskupené podle stránky, nejbližší termín nahoře.

**Synchronizace**
- Ukládání hned po změně (text s debounce ~500 ms), optimistické UI.
- Realtime odběr `pages`, `sections`, `tasks` → změny kolegy se objeví bez reloadu. Nepřepisovat řádek, který zrovna edituju (když má focus, změnu aplikovat po blur).
- Indikátor stavu: Uloženo / Ukládám… / Offline / Chyba.

---

## Design

- Notion-like: čistý, hodně bílého místa, jemné hover stavy, žádné těžké stíny.
- Barvy: pozadí `#ffffff`, sidebar `#f7f7f5`, text Deep Ink `#101112`, akcent Scan Blue `#246bfd`.
- Písmo: **Poppins** (nadpisy), **Inter** (UI a text). Google Fonts.
- Podpora dark mode přes `prefers-color-scheme`.
- Celé UI česky.

---

## Struktura projektu

```
scanity-workspace/
├─ CLAUDE.md
├─ README.md                  # jak to rozjet (Supabase, secrets, Pages)
├─ supabase/schema.sql
├─ supabase/seed.sql          # NEcommitovat s reálnými daty → v .gitignore, jen seed.example.sql
├─ .github/workflows/deploy.yml
├─ index.html
├─ vite.config.ts
└─ src/
   ├─ lib/supabase.ts         # klient
   ├─ lib/api.ts              # CRUD + realtime
   ├─ lib/order.ts            # výpočet position mezi sousedy
   ├─ auth/Login.tsx
   ├─ components/Sidebar.tsx, PageView.tsx, Section.tsx, TaskRow.tsx, TaskDrawer.tsx, Overview.tsx
   └─ styles.css
```

---

## Startovní obsah (vložit ručně po nasazení, ne do repa)

Reálný obsah je jen lokálně v `supabase/seed.sql` a `supabase/migration-*-data.sql` (v `.gitignore`). Do tohoto souboru ho nepsat, `CLAUDE.md` je ve veřejném repu.

---

## Aktuální podoba (nahrazuje sekce Layout, Design a Struktura výše tam, kde se liší)

- **Horní karty místo sidebaru:** Přehled, Vývoj, Odvětví, Zakázky, CRM, Statistiky. Na mobilu spodní lišta s tlačítkem +.
- **Vzhled:** moderní a minimalistický, ne Notion. Přepínač světlého a tmavého režimu (`data-theme` na `<html>`), SVG ikony v `components/Icon.tsx`, emoji jen jako obsah stránek. Červené logo jako favicon, ať je záložka hned poznat.
- **Data:** `supabase/migration-002.sql`. Produkt, odvětví, zakázka i šablona jsou řádky `pages` s `kind`, takže všechny mají sekce a úkoly. Nové tabulky: `companies`, `contacts`, `ideas`, `milestones`, `comments`.
- **Automatické CRM:** `ensureCompany` a `ensureContact` v `lib/useWorkspace.ts` najdou záznam bez ohledu na velikost písmen a diakritiku, nebo ho založí.
- **Synchronizace:** všechny tabulky jdou přes frontu v `lib/useWorkspace.ts`. Nová tabulka patří do `TABLES` v `lib/types.ts` a do `fetchAll`.

---

## Postup pro Claude Code

1. Scaffold Vite + React + TS, `base`, hash routing, `.gitignore` (`.env*`, `supabase/seed.sql`).
2. `supabase/schema.sql` přesně dle výše.
3. Login obrazovka + ochrana celé appky (bez session → jen login; přihlášen, ale není v `members` → hláška „Nemáte přístup“).
4. Sidebar + stránky (CRUD).
5. Sekce + úkoly + klávesové zkratky.
6. Boční panel detailu, filtry, Přehled, Moje úkoly.
7. Drag & drop.
8. Realtime + indikátor stavu.
9. `deploy.yml` a README s kroky nasazení.
10. Kontrola: build projde, appka funguje na mobilu, v buildu není nic jiného než URL a anon key.

## Kritéria hotovo

- Nepřihlášený člověk na veřejné URL neuvidí žádný úkol ani název stránky (ani v Network tabu).
- Přihlášený člověk, který není v `members`, dostane prázdná data (ověřeno RLS, ne jen skrytím v UI).
- Změna u kolegy se mi objeví do pár sekund bez reloadu.
- V repu nejsou žádná reálná data ani tajné klíče.

## Konvence

- Commity a UI česky, kód a názvy proměnných anglicky.
- Žádné mazání dat bez potvrzení (stránka, sekce s úkoly).
- Malé komponenty, žádná globální state knihovna, stačí React state + vlastní hook nad Supabase.
