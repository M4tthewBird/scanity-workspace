import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import * as api from './api';
import type { Backend, RemoteChange, Row } from './api';
import { between, byPosition, hasGap, STEP } from './order';
import type { Member, Page, Section, TableName, Task, WorkspaceData } from './types';

export type SaveStatus = 'saved' | 'saving' | 'offline' | 'error';

export interface WorkspaceState extends WorkspaceData {
  ready: boolean;
  loadFailed: boolean;
  status: SaveStatus;
}

type Op =
  | { kind: 'insert'; table: TableName; id: string; row: Row }
  | { kind: 'update'; table: TableName; id: string; patch: object }
  | { kind: 'delete'; table: TableName; id: string; removedKeys: string[] };

const TEXT_DEBOUNCE_MS = 500;
const RETRY_MS = 5000;

const rowKey = (table: TableName, id: string) => `${table}:${id}`;

function isNetworkError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? '';
  return navigator.onLine === false || /failed to fetch|network|load failed/i.test(message);
}

function isOlder(a: Row, b: Row): boolean {
  return Boolean(a.updated_at && b.updated_at) && Date.parse(a.updated_at!) < Date.parse(b.updated_at!);
}

export function createWorkspaceStore(userId: string, backend: Backend = api) {
  let state: WorkspaceState = {
    members: [],
    pages: [],
    sections: [],
    tasks: [],
    ready: false,
    loadFailed: false,
    status: 'saved',
  };
  const listeners = new Set<() => void>();

  const queue: Op[] = [];
  const dirty = new Map<string, { table: TableName; id: string; patch: object; timer?: ReturnType<typeof setTimeout> }>();
  // Změny od kolegů u řádků, které zrovna edituji. Aplikují se až po blur a dokončení zápisů.
  const deferred = new Map<string, { table: TableName; row: Row }>();
  const deleted = new Set<string>();
  let focused: string | null = null;
  let pumping = false;
  let offline = false;
  let failed = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let refreshToken = 0;

  const set = (patch: Partial<WorkspaceState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  const rows = (table: TableName) => state[table] as unknown as Row[];
  const setRows = (table: TableName, next: Row[]) => set({ [table]: next } as Partial<WorkspaceState>);

  const syncStatus = () => {
    const status: SaveStatus =
      offline || navigator.onLine === false
        ? 'offline'
        : failed
          ? 'error'
          : dirty.size > 0 || queue.length > 0
            ? 'saving'
            : 'saved';
    if (status !== state.status) set({ status });
  };

  const isHeld = (key: string) =>
    focused === key || dirty.has(key) || queue.some((op) => rowKey(op.table, op.id) === key);

  const upsertLocal = (table: TableName, row: Row) => {
    const current = rows(table);
    const exists = current.some((r) => r.id === row.id);
    setRows(table, exists ? current.map((r) => (r.id === row.id ? { ...r, ...row } : r)) : [...current, row]);
  };

  const applyIfNewer = (table: TableName, row: Row) => {
    const existing = rows(table).find((r) => r.id === row.id);
    if (!existing || !isOlder(row, existing)) upsertLocal(table, row);
  };

  const releaseDeferred = (key: string) => {
    const entry = deferred.get(key);
    if (entry && !isHeld(key)) {
      deferred.delete(key);
      applyIfNewer(entry.table, entry.row);
    }
  };

  // Lokální smazání včetně toho, co v databázi udělají cizí klíče. Vrací klíče smazaných řádků.
  const removeLocal = (table: TableName, id: string): string[] => {
    const removed = [rowKey(table, id)];
    if (table === 'pages') {
      for (const s of state.sections) if (s.page_id === id) removed.push(rowKey('sections', s.id));
      for (const t of state.tasks) if (t.page_id === id) removed.push(rowKey('tasks', t.id));
      set({
        pages: state.pages.filter((p) => p.id !== id),
        sections: state.sections.filter((s) => s.page_id !== id),
        tasks: state.tasks.filter((t) => t.page_id !== id),
      });
    } else if (table === 'sections') {
      set({
        sections: state.sections.filter((s) => s.id !== id),
        tasks: state.tasks.map((t) => (t.section_id === id ? { ...t, section_id: null } : t)),
      });
    } else {
      set({ tasks: state.tasks.filter((t) => t.id !== id) });
    }
    for (const key of removed) {
      deleted.add(key);
      deferred.delete(key);
      const entry = dirty.get(key);
      if (entry) clearTimeout(entry.timer);
      dirty.delete(key);
    }
    return removed;
  };

  const pendingOverlay = (table: TableName, id: string): object => {
    const key = rowKey(table, id);
    let overlay: object = {};
    for (const op of queue) {
      if (op.kind === 'update' && rowKey(op.table, op.id) === key) overlay = { ...overlay, ...op.patch };
    }
    return { ...overlay, ...dirty.get(key)?.patch };
  };

  const scheduleRetry = () => {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => void pump(), RETRY_MS);
  };

  // Zápisy běží přísně za sebou, aby se např. úprava nového úkolu nepředběhla s jeho vložením.
  const pump = async () => {
    if (pumping) return;
    pumping = true;
    let needsRefresh = false;
    while (queue.length > 0) {
      const op = queue[0];
      const key = rowKey(op.table, op.id);
      try {
        let saved: Row | null = null;
        if (op.kind === 'insert') saved = await backend.insertRow(op.table, op.row);
        else if (op.kind === 'update') saved = await backend.updateRow(op.table, op.id, op.patch);
        else await backend.deleteRow(op.table, op.id);

        queue.shift();
        offline = false;
        failed = false;
        if (saved && !deleted.has(key)) upsertLocal(op.table, { ...saved, ...pendingOverlay(op.table, op.id) });
        releaseDeferred(key);
      } catch (error) {
        if (isNetworkError(error)) {
          offline = true;
          syncStatus();
          scheduleRetry();
          pumping = false;
          return;
        }
        console.error('Uložení selhalo', error);
        queue.shift();
        if (op.kind === 'delete') op.removedKeys.forEach((k) => deleted.delete(k));
        failed = true;
        needsRefresh = true;
      }
      syncStatus();
    }
    pumping = false;
    syncStatus();
    if (needsRefresh) void refresh();
  };

  const enqueue = (op: Op) => {
    queue.push(op);
    syncStatus();
    void pump();
  };

  const flush = (key: string) => {
    const entry = dirty.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    dirty.delete(key);
    enqueue({ kind: 'update', table: entry.table, id: entry.id, patch: entry.patch });
  };

  const flushAll = () => [...dirty.keys()].forEach(flush);

  function update<T extends TableName>(
    table: T,
    id: string,
    patch: Partial<T extends 'pages' ? Page : T extends 'sections' ? Section : Task>,
    debounce = false,
  ) {
    const key = rowKey(table, id);
    if (deleted.has(key)) return;
    upsertLocal(table, { id, ...patch } as Row);
    const entry = dirty.get(key) ?? { table, id, patch: {} };
    clearTimeout(entry.timer);
    entry.patch = { ...entry.patch, ...patch };
    dirty.set(key, entry);
    if (debounce) {
      entry.timer = setTimeout(() => flush(key), TEXT_DEBOUNCE_MS);
      syncStatus();
    } else {
      flush(key);
    }
  }

  const insert = (table: TableName, row: Row) => {
    upsertLocal(table, row);
    enqueue({ kind: 'insert', table, id: row.id, row });
  };

  const remove = (table: TableName, id: string) => {
    const removedKeys = removeLocal(table, id);
    for (let i = queue.length - 1; i > 0; i--) {
      const op = queue[i];
      if (op.kind === 'update' && removedKeys.includes(rowKey(op.table, op.id))) queue.splice(i, 1);
    }
    enqueue({ kind: 'delete', table, id, removedKeys });
  };

  const refresh = async () => {
    const token = ++refreshToken;
    try {
      const fetched = await backend.fetchAll();
      if (token !== refreshToken) return;
      const merge = (table: TableName, incoming: Row[]): Row[] => {
        const ids = new Set(incoming.map((r) => r.id));
        const merged: Row[] = [];
        for (const row of incoming) {
          const key = rowKey(table, row.id);
          if (deleted.has(key)) continue;
          if (isHeld(key)) {
            deferred.set(key, { table, row });
            merged.push(rows(table).find((r) => r.id === row.id) ?? row);
          } else {
            merged.push(row);
          }
        }
        // Řádky vložené u mě, které ještě nedorazily na server.
        const pendingInserts = rows(table).filter(
          (r) =>
            !ids.has(r.id) &&
            queue.some((op) => op.kind === 'insert' && op.table === table && op.id === r.id),
        );
        return [...merged, ...pendingInserts];
      };
      set({
        members: fetched.members,
        pages: merge('pages', fetched.pages as unknown as Row[]) as unknown as Page[],
        sections: merge('sections', fetched.sections as unknown as Row[]) as unknown as Section[],
        tasks: merge('tasks', fetched.tasks as unknown as Row[]) as unknown as Task[],
        ready: true,
        loadFailed: false,
      });
    } catch (error) {
      if (token !== refreshToken) return;
      console.error('Načtení selhalo', error);
      if (!state.ready) set({ loadFailed: true });
    }
  };

  const onRemote = (change: RemoteChange) => {
    if (change.type === 'delete') {
      if (!deleted.has(rowKey(change.table, change.id))) removeLocal(change.table, change.id);
      return;
    }
    const key = rowKey(change.table, change.row.id);
    if (deleted.has(key)) return;
    if (isHeld(key)) deferred.set(key, { table: change.table, row: change.row });
    else applyIfNewer(change.table, change.row);
  };

  const onOnline = () => {
    offline = false;
    syncStatus();
    void pump();
    void refresh();
  };
  const onOffline = () => syncStatus();
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flushAll();
    else void refresh();
  };
  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    flushAll();
    if (queue.length > 0) event.preventDefault();
  };

  const siblingTasks = (pageId: string, sectionId: string | null, exceptId?: string) =>
    byPosition(state.tasks.filter((t) => t.page_id === pageId && t.section_id === sectionId && t.id !== exceptId));

  // Pozice pro vložení na daný index. Když mezi sousedy dojde místo, přečísluje celou sekci.
  const positionAt = (siblings: Task[], index: number): number => {
    const before = siblings[index - 1]?.position;
    const after = siblings[index]?.position;
    if (hasGap(before, after)) return between(before, after);
    siblings.forEach((t, i) => update('tasks', t.id, { position: (i >= index ? i + 2 : i + 1) * STEP }));
    return (index + 1) * STEP;
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState: () => state,

    start() {
      const unsubscribe = backend.subscribe(onRemote, () => void refresh());
      void refresh();
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      window.addEventListener('beforeunload', onBeforeUnload);
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        unsubscribe();
        clearTimeout(retryTimer);
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
        window.removeEventListener('beforeunload', onBeforeUnload);
        document.removeEventListener('visibilitychange', onVisibility);
      };
    },
    reload: () => void refresh(),

    focusRow(table: TableName, id: string) {
      focused = rowKey(table, id);
    },
    blurRow(table: TableName, id: string) {
      const key = rowKey(table, id);
      flush(key);
      if (focused === key) focused = null;
      releaseDeferred(key);
    },

    update,

    createPage(): string {
      const id = crypto.randomUUID();
      const last = byPosition(state.pages).at(-1);
      insert('pages', {
        id,
        title: '',
        icon: '📄',
        description: '',
        position: between(last?.position),
      } as Row);
      return id;
    },
    deletePage: (id: string) => remove('pages', id),

    createSection(pageId: string): string {
      const id = crypto.randomUUID();
      const last = byPosition(state.sections.filter((s) => s.page_id === pageId)).at(-1);
      insert('sections', { id, page_id: pageId, title: 'Nová sekce', position: between(last?.position) } as Row);
      return id;
    },
    deleteSection: (id: string) => remove('sections', id),

    createTask(pageId: string, sectionId: string | null, afterId?: string, assignee?: string | null): string {
      const id = crypto.randomUUID();
      const siblings = siblingTasks(pageId, sectionId);
      const afterIndex = afterId ? siblings.findIndex((t) => t.id === afterId) : -1;
      const index = afterIndex >= 0 ? afterIndex + 1 : siblings.length;
      insert('tasks', {
        id,
        page_id: pageId,
        section_id: sectionId,
        text: '',
        done: false,
        priority: null,
        assignee: assignee ?? null,
        due: null,
        notes: '',
        position: positionAt(siblings, index),
        created_by: userId,
      } as Row);
      return id;
    },
    deleteTask: (id: string) => remove('tasks', id),

    moveTask(taskId: string, sectionId: string | null, overTaskId: string | null, before: boolean) {
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return;
      const siblings = siblingTasks(task.page_id, sectionId, taskId);
      const overIndex = overTaskId ? siblings.findIndex((t) => t.id === overTaskId) : -1;
      const index = overIndex < 0 ? siblings.length : before ? overIndex : overIndex + 1;
      update('tasks', taskId, { section_id: sectionId, position: positionAt(siblings, index) });
    },

    moveTaskToPage(taskId: string, pageId: string) {
      const siblings = siblingTasks(pageId, null, taskId);
      update('tasks', taskId, { page_id: pageId, section_id: null, position: positionAt(siblings, siblings.length) });
    },
  };
}

export type WorkspaceActions = ReturnType<typeof createWorkspaceStore>;
export type Workspace = WorkspaceState & { actions: WorkspaceActions; me: Member };

export function useWorkspaceStore(me: Member): Workspace {
  const [store] = useState(() => createWorkspaceStore(me.user_id));
  useEffect(() => store.start(), [store]);
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return { ...state, actions: store, me };
}

export const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error('useWorkspace mimo WorkspaceContext');
  return workspace;
}
