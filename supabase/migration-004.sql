-- Projektové dlaždice na Přehledu: stav, krátký status a připnutí. Spusťte jednou po migration-002.sql.
-- Jen přidává sloupce, stávající data nemění. Reálný obsah patří do migration-004-data.sql (v .gitignore).

alter table pages
  add column status text not null default '',
  add column state text check (state in ('active','waiting','hot','paused')),
  add column pinned boolean not null default false;
