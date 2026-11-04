-- Pohledy na sekce (seznam, kanban, tabulka, timeline) a k tomu stav a začátek úkolu.
-- Spusťte jednou po migration-004.sql. Jen přidává sloupce, stávající data nemění.

alter table sections
  add column view text not null default 'list' check (view in ('list','board','table','timeline'));

alter table tasks
  add column status text check (status in ('todo','doing','waiting','done')),
  add column start date;
