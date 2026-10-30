-- Přístup jen pro čtení, např. pro dotazy přes Claude. Volitelné.
-- Heslo doplňte až v SQL editoru a nikam ho necommitujte.

create role workspace_reader login password 'DOPLŇTE-DLOUHÉ-NÁHODNÉ-HESLO' bypassrls;
grant usage on schema public to workspace_reader;
grant select on members, pages, sections, tasks, companies, contacts, ideas, milestones, comments to workspace_reader;
