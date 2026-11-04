import { supabase } from './supabase';
import { OPTIONAL_TABLES, TABLES } from './types';
import type { Member, TableName, WorkspaceData } from './types';

export type Row = { id: string; updated_at?: string | null };
export type RemoteChange =
  | { type: 'upsert'; table: TableName; row: Row }
  | { type: 'delete'; table: TableName; id: string };

const PAGE_SIZE = 1000;

export async function fetchMember(userId: string): Promise<Member | null> {
  const { data, error } = await supabase.from('members').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as Member | null;
}

// PostgREST vrací nejvýš 1000 řádků na dotaz, proto čteme po stránkách.
async function fetchRows<T>(table: string, orderBy: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (data.length < PAGE_SIZE) return rows;
  }
}

// Tabulky, které v databázi zatím nejsou. UI podle toho skryje funkce, které by zápisem selhaly.
export const missingTables = new Set<TableName>();

// Chybějící tabulka (migrace ještě neproběhla) vrátí prázdný seznam místo chyby celé appky.
async function fetchOptional<T>(table: TableName, orderBy: string): Promise<T[]> {
  try {
    const rows = await fetchRows<T>(table, orderBy);
    missingTables.delete(table);
    return rows;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === '42P01' || code === 'PGRST205') {
      missingTables.add(table);
      return [];
    }
    throw error;
  }
}

export const hasMeetings = () => !missingTables.has('meetings');

export async function fetchAll(): Promise<WorkspaceData> {
  const [members, pages, sections, tasks, companies, contacts, ideas, milestones, comments, meetings, meeting_notes] = await Promise.all([
    fetchRows<WorkspaceData['members'][number]>('members', 'name'),
    fetchRows<WorkspaceData['pages'][number]>('pages', 'position'),
    fetchRows<WorkspaceData['sections'][number]>('sections', 'position'),
    fetchRows<WorkspaceData['tasks'][number]>('tasks', 'position'),
    fetchRows<WorkspaceData['companies'][number]>('companies', 'name'),
    fetchRows<WorkspaceData['contacts'][number]>('contacts', 'name'),
    fetchRows<WorkspaceData['ideas'][number]>('ideas', 'created_at'),
    fetchRows<WorkspaceData['milestones'][number]>('milestones', 'position'),
    fetchRows<WorkspaceData['comments'][number]>('comments', 'created_at'),
    fetchOptional<WorkspaceData['meetings'][number]>('meetings', 'started_at'),
    fetchOptional<WorkspaceData['meeting_notes'][number]>('meeting_notes', 'position'),
  ]);
  return { members, pages, sections, tasks, companies, contacts, ideas, milestones, comments, meetings, meeting_notes };
}

// Upsert místo insertu: opakování po výpadku spojení nesmí skončit chybou duplicity.
export async function insertRow(table: TableName, row: Row): Promise<Row> {
  const { data, error } = await supabase.from(table).upsert(row).select().single();
  if (error) throw error;
  return data as Row;
}

export async function updateRow(table: TableName, id: string, patch: object): Promise<Row | null> {
  const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().maybeSingle();
  if (error) throw error;
  return data as Row | null;
}

export async function deleteRow(table: TableName, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

let channelCounter = 0;

export function subscribe(onChange: (change: RemoteChange) => void, onConnected: () => void): () => void {
  const listen = (tables: TableName[]) => {
    const channel = supabase.channel(`workspace-${++channelCounter}`);
    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Row).id;
          if (id) onChange({ type: 'delete', table, id });
        } else {
          onChange({ type: 'upsert', table, row: payload.new as Row });
        }
      });
    }
    return channel;
  };
  const main = listen(TABLES.filter((t) => !OPTIONAL_TABLES.includes(t)));
  // Volá se i po každém znovupřipojení, aby se dohnaly změny z doby výpadku.
  main.subscribe((status) => {
    if (status === 'SUBSCRIBED') onConnected();
  });
  // Tabulky z novějších migrací ve vlastním kanálu: když chybí, nesmí shodit odběr ostatních.
  const optional = listen(OPTIONAL_TABLES);
  optional.subscribe();
  return () => {
    void supabase.removeChannel(main);
    void supabase.removeChannel(optional);
  };
}

export type Backend = Pick<typeof import('./api'), 'fetchAll' | 'insertRow' | 'updateRow' | 'deleteRow' | 'subscribe'>;
