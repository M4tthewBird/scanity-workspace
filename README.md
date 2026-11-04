# Scanity Workspace

Interní to-do appka týmu Scanity ve stylu Notion: stránky, sekce a úkoly se synchronizací mezi kolegy.

Repo je veřejné, a proto v něm nejsou žádná data. Data a přihlášení řeší Supabase a chrání je Row Level Security. Do repa a do buildu smí jen `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY`. Klíč `service_role` sem nikdy nepatří.

## Nasazení

### 1. Supabase

1. Založte projekt na [supabase.com](https://supabase.com).
2. V **SQL Editoru** spusťte `supabase/schema.sql` a potom `supabase/migration-002.sql` , `supabase/migration-004.sql`, `supabase/migration-005.sql` a `supabase/migration-006.sql`.
3. **Authentication → Sign In / Providers**: vypněte *Allow new users to sign up*.
4. **Authentication → URL Configuration**:
   - Site URL: `https://m4tthewbird.github.io/scanity-workspace/`
   - Redirect URLs: `https://m4tthewbird.github.io/scanity-workspace/` a `http://localhost:5173/scanity-workspace/`
5. **Authentication → Users → Invite user**: pozvěte každého člena. Po kliknutí na odkaz v e-mailu si nastaví heslo.
6. Každého člena přidejte do allowlistu. UUID najdete v **Authentication → Users**:

   ```sql
   insert into members (user_id, name, color)
   values ('<uuid z auth.users>', 'Jméno', '#246bfd');
   ```

   Kdo v `members` není, po přihlášení uvidí jen hlášku „Nemáte přístup“ a databáze mu nevrátí žádná data.

7. Volitelně vložte startovní obsah: zkopírujte `supabase/seed.example.sql` do `supabase/seed.sql` (je v `.gitignore`), upravte ho a spusťte v SQL Editoru.

### 2. GitHub

1. **Settings → Secrets and variables → Actions**: přidejte `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API).
2. **Settings → Pages → Source**: zvolte **GitHub Actions**.
3. Pushněte do `main`. Workflow `.github/workflows/deploy.yml` appku sestaví a nasadí.

### 3. Přístup jen pro čtení (volitelné)

Pro dotazy nad daty bez možnosti cokoli změnit, např. přes Claude, spusťte `supabase/readonly-role.sql` s vlastním dlouhým heslem. Přístupové údaje patří jen do `.env.local`, nikdy do repa. Klíč `service_role` k tomu nepoužívejte.

## Karty appky

- **Přehled**: co hoří, co běží a co se dělo.
- **Vývoj**: produkty, společné nápady, úkoly a roadmapa.
- **Odvětví**: velké karty se zakázkami a klienty daného odvětví.
- **Zakázky**: kanban od poptávky po fakturu. Nová zakázka dostane kopii úkolů ze šablony.
- **CRM**: firmy a kontakty. Založí se samy ze zakázky nebo z rychlého zápisu kontaktu, případně ručně.
- **Statistiky**: obrat, rozpracované zakázky a úkoly.

## Lokální vývoj

```sh
cp .env.example .env.local   # doplňte URL a anon key
npm install
npm run dev
```

Appka běží na `http://localhost:5173/scanity-workspace/`.

## Řešení problémů

- **`permission denied for table …`**: projekt nemá výchozí oprávnění pro Data API. Spusťte v SQL Editoru:

  ```sql
  grant usage on schema public to authenticated;
  grant select on members to authenticated;
  grant select, insert, update, delete on pages, sections, tasks to authenticated;
  ```

- **Projekt neodpovídá**: projekt na free tieru se po zhruba týdnu bez aktivity uspí. Probudíte ho tlačítkem *Restore* v dashboardu Supabase.
- **Změny kolegů se neobjevují bez reloadu**: zkontrolujte, že tabulky jsou v publikaci `supabase_realtime` (poslední řádek `schema.sql`).
