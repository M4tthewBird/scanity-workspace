-- Vzor startovního obsahu. Zkopírujte do supabase/seed.sql (je v .gitignore),
-- doplňte vlastní data a spusťte v SQL editoru Supabase.
-- Skutečná data do repa nepatří.

with p as (
  insert into pages (title, icon, position)
  values ('Ukázková stránka', '📄', 1024)
  returning id
)
insert into tasks (page_id, text, position)
select p.id, t.text, t.ord * 1024
from p, unnest(array[
  'První úkol',
  'Druhý úkol'
]) with ordinality as t(text, ord);
