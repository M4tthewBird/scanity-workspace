import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import * as api from './api';
import type { Backend, RemoteChange, Row } from './api';
import { between, byPosition, hasGap, STEP } from './order';
import { sameText } from './text';
import { JOB_STAGES, TABLES } from './types';
import type {
  CommentTarget,
  Contact,
  Idea,
  JobStage,
  Member,
  Milestone,
  Page,
  PageKind,
  Section,
  SectionView,
  TableName,
  TableRows,
  Task,
  TaskStatus,
  WorkspaceData,
} from './types';

export type SaveStatus = 'saved' | 'saving' | 'offline' | 'error';

export interface WorkspaceState extends WorkspaceData {
  ready: boolean;
  loadFailed: boolean;
  status: SaveStatus;
}

export interface NewJob {
  title: string;
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  industryId?: string | null;
  price?: number | null;
}

type Op =
  | { kind: 'insert'; table: TableName; id: string; row: Row }
  | { kind: 'update'; table: TableName; id: string; patch: object }
  | { kind: 'delete'; table: TableName; id: string; removedKeys: string[] };

type AnyRow = Row & Record<string, unknown>;

const TEXT_DEBOUNCE_MS = 500;
const RETRY_MS = 5000;

// Odkazy, které databáze při smazání řádku nastaví na null.
const SET_NULL_REFS: Partial<Record<TableName, [TableName, string][]>> = {
  pages: [
    ['pages', 'industry_id'],
    ['companies', 'industry_id'],
    ['ideas', 'product_id'],
    ['milestones', 'product_id'],
    ['meeting_notes', 'page_id'],
  ],
  sections: [['tasks', 'section_id']],
  milestones: [['tasks', 'milestone_id']],
  companies: [
    ['contacts', 'company_id'],
    ['pages', 'company_id'],
  ],
  contacts: [['pages', 'contact_id']],
};

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
    companies: [],
    contacts: [],
    ideas: [],
    milestones: [],
    comments: [],
    meetings: [],
    meeting_notes: [],
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

  const rows = (table: TableName) => state[table] as unknown as AnyRow[];
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
        sections: state.sections.filter((s) => s.page_id !== id),
        tasks: state.tasks.filter((t) => t.page_id !== id),
      });
    }
    setRows(table, rows(table).filter((r) => r.id !== id));
    for (const [refTable, field] of SET_NULL_REFS[table] ?? []) {
      const current = rows(refTable);
      if (current.some((r) => r[field] === id)) {
        setRows(refTable, current.map((r) => (r[field] === id ? { ...r, [field]: null } : r)));
      }
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

  function update<T extends TableName>(table: T, id: string, patch: Partial<TableRows[T]>, debounce = false) {
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

  function insert<T extends TableName>(table: T, row: Partial<TableRows[T]>): string {
    const id = crypto.randomUUID();
    const full = { id, ...row } as Row;
    upsertLocal(table, full);
    enqueue({ kind: 'insert', table, id, row: full });
    return id;
  }

  const remove = (table: TableName, id: string) => {
    const removedKeys = removeLocal(table, id);
    for (let i = queue.length - 1; i > 0; i--) {
      const op = queue[i];
      if (op.kind === 'update' && removedKeys.includes(rowKey(op.table, op.id))) queue.splice(i, 1);
    }
    enqueue({ kind: 'delete', table, id, removedKeys });
    if (table !== 'comments') {
      for (const comment of state.comments) if (comment.target_id === id) remove('comments', comment.id);
    }
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
      const next: Partial<WorkspaceState> = { members: fetched.members, ready: true, loadFailed: false };
      for (const table of TABLES) {
        Object.assign(next, { [table]: merge(table, fetched[table] as unknown as Row[]) });
      }
      set(next);
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

  const createPage = (kind: PageKind, extra: Partial<Page> = {}): string => {
    const last = byPosition(state.pages.filter((p) => p.kind === kind)).at(-1);
    return insert('pages', {
      kind,
      title: '',
      icon: '📄',
      description: '',
      tags: [],
      position: between(last?.position),
      ...extra,
    });
  };

  const createTask = (
    pageId: string,
    sectionId: string | null,
    afterId?: string,
    assignee?: string | null,
    extra: Partial<Task> = {},
  ): string => {
    const siblings = siblingTasks(pageId, sectionId);
    const afterIndex = afterId ? siblings.findIndex((t) => t.id === afterId) : -1;
    const index = afterIndex >= 0 ? afterIndex + 1 : siblings.length;
    return insert('tasks', {
      page_id: pageId,
      section_id: sectionId,
      milestone_id: null,
      text: '',
      done: false,
      priority: null,
      assignee: assignee ?? null,
      due: null,
      notes: '',
      tags: [],
      position: positionAt(siblings, index),
      created_by: userId,
      ...extra,
    });
  };

  // Automatické CRM: firma a kontakt se založí při prvním zmínění, jinak se najde stávající.
  const ensureCompany = (name: string | undefined, industryId?: string | null): string | null => {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    const existing = state.companies.find((c) => sameText(c.name, trimmed));
    if (existing) {
      if (industryId && !existing.industry_id) update('companies', existing.id, { industry_id: industryId });
      return existing.id;
    }
    return insert('companies', {
      name: trimmed,
      industry_id: industryId ?? null,
      website: '',
      notes: '',
      created_by: userId,
    });
  };

  const ensureContact = (
    input: { name?: string; email?: string; phone?: string; companyId?: string | null },
  ): string | null => {
    const name = input.name?.trim() ?? '';
    const email = input.email?.trim() ?? '';
    const phone = input.phone?.trim() ?? '';
    if (!name && !email && !phone) return null;
    const existing = state.contacts.find(
      (c) => (email && sameText(c.email ?? '', email)) || (name && sameText(c.name, name)),
    );
    if (existing) {
      const patch: Partial<Contact> = {};
      if (email && !existing.email) patch.email = email;
      if (phone && !existing.phone) patch.phone = phone;
      if (input.companyId && !existing.company_id) patch.company_id = input.companyId;
      if (Object.keys(patch).length > 0) update('contacts', existing.id, patch);
      return existing.id;
    }
    return insert('contacts', {
      name: name || email || phone,
      company_id: input.companyId ?? null,
      role: '',
      email,
      phone,
      notes: '',
      created_by: userId,
    });
  };

  const addComment = (targetType: CommentTarget, targetId: string, body: string, system = false): string =>
    insert('comments', { target_type: targetType, target_id: targetId, body, system, author: userId });

  const createJob = (input: NewJob): string => {
    const companyId = ensureCompany(input.companyName, input.industryId);
    const contactId = ensureContact({
      name: input.contactName,
      email: input.email,
      phone: input.phone,
      companyId,
    });
    const jobId = createPage('job', {
      title: input.title.trim(),
      icon: '💼',
      stage: 'poptavka',
      industry_id: input.industryId ?? null,
      company_id: companyId,
      contact_id: contactId,
      price: input.price ?? null,
    });
    // Nová zakázka dostane kopii sekcí a úkolů ze šablony.
    const template = state.pages.find((p) => p.kind === 'template');
    if (template) {
      const sectionIds = new Map<string, string>();
      for (const section of byPosition(state.sections.filter((s) => s.page_id === template.id))) {
        sectionIds.set(section.id, insert('sections', { page_id: jobId, title: section.title, position: section.position }));
      }
      for (const task of byPosition(state.tasks.filter((t) => t.page_id === template.id))) {
        insert('tasks', {
          page_id: jobId,
          section_id: task.section_id ? (sectionIds.get(task.section_id) ?? null) : null,
          milestone_id: null,
          text: task.text,
          done: false,
          priority: task.priority,
          assignee: null,
          due: null,
          notes: task.notes,
          tags: task.tags,
          position: task.position,
          created_by: userId,
        });
      }
    }
    return jobId;
  };

  // Úkol z rychlého zápisu nebo z nápadu potřebuje stránku, poslední možnost je založit obecnou.
  const defaultProductId = (): string =>
    byPosition(state.pages.filter((p) => p.kind === 'product'))[0]?.id ??
    createPage('product', { title: 'Obecné', icon: '📌' });

  const createMilestone = (input: Partial<Milestone>): string => {
    const last = byPosition(state.milestones).at(-1);
    return insert('milestones', {
      title: '',
      product_id: null,
      start_date: null,
      end_date: null,
      notes: '',
      position: between(last?.position),
      ...input,
    });
  };

  const finishIdea = (idea: Idea) => update('ideas', idea.id, { status: 'done' });

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
    remove,

    createPage,
    createTask,
    defaultProductId,
    createJob,
    createMilestone,
    addComment,

    deleteComment: (id: string) => remove('comments', id),

    createSection(pageId: string, extra: Partial<Section> = {}): string {
      const last = byPosition(state.sections.filter((s) => s.page_id === pageId)).at(-1);
      return insert('sections', { page_id: pageId, title: 'Nová sekce', position: between(last?.position), ...extra });
    },

    // Přepnutí pohledu úkolů bez sekce nejdřív založí sekci, protože pohled patří sekci.
    setSectionView(pageId: string, sectionId: string | null, view: SectionView): string {
      if (sectionId) {
        update('sections', sectionId, { view });
        return sectionId;
      }
      const first = byPosition(state.sections.filter((s) => s.page_id === pageId))[0];
      const id = insert('sections', { page_id: pageId, title: 'Úkoly', position: between(undefined, first?.position), view });
      for (const task of state.tasks.filter((t) => t.page_id === pageId && t.section_id === null)) {
        update('tasks', task.id, { section_id: id });
      }
      return id;
    },

    startMeeting(): string {
      const date = new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
      return insert('meetings', { title: `Meeting ${date}`, started_at: new Date().toISOString(), ended_at: null, created_by: userId });
    },
    endMeeting(id: string) {
      update('meetings', id, { ended_at: new Date().toISOString() });
    },
    deleteMeeting(id: string) {
      for (const note of state.meeting_notes.filter((n) => n.meeting_id === id)) remove('meeting_notes', note.id);
      remove('meetings', id);
    },
    addMeetingNote(meetingId: string, body: string, pageId: string | null): string {
      const last = byPosition(state.meeting_notes.filter((n) => n.meeting_id === meetingId)).at(-1);
      return insert('meeting_notes', {
        meeting_id: meetingId,
        page_id: pageId,
        body,
        position: between(last?.position),
        created_by: userId,
      });
    },
    // Bod ze zápisu jako úkol v přiřazeném projektu.
    meetingNoteToTask(noteId: string): string | null {
      const note = state.meeting_notes.find((n) => n.id === noteId);
      if (!note?.page_id) return null;
      return createTask(note.page_id, null, undefined, null, { text: note.body, notes: 'Z meetingu' });
    },

    setTaskStatus(taskId: string, status: TaskStatus) {
      update('tasks', taskId, { status, done: status === 'done' });
    },

    // Kopie stránky i se sekcemi a úkoly. Komentáře a historie zůstávají u originálu.
    duplicatePage(pageId: string, patch: Partial<Page> = {}): string {
      const page = state.pages.find((p) => p.id === pageId);
      if (!page) return '';
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = page;
      const copyId = insert('pages', { ...rest, title: `${page.title || 'Bez názvu'} (kopie)`, ...patch });
      const sectionIds = new Map<string, string>();
      for (const section of byPosition(state.sections.filter((s) => s.page_id === pageId))) {
        const { id, page_id: _p, ...sectionRest } = section;
        sectionIds.set(id, insert('sections', { ...sectionRest, page_id: copyId }));
      }
      for (const task of byPosition(state.tasks.filter((t) => t.page_id === pageId))) {
        const { id: _t, created_at: _tc, updated_at: _tu, ...taskRest } = task;
        insert('tasks', {
          ...taskRest,
          page_id: copyId,
          section_id: task.section_id ? (sectionIds.get(task.section_id) ?? null) : null,
          created_by: userId,
        });
      }
      return copyId;
    },
    deleteSection: (id: string) => remove('sections', id),
    deleteTask: (id: string) => remove('tasks', id),
    deletePage: (id: string) => remove('pages', id),

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

    setJobStage(jobId: string, stage: JobStage) {
      const job = state.pages.find((p) => p.id === jobId);
      if (!job || job.stage === stage) return;
      update('pages', jobId, { stage });
      const label = JOB_STAGES.find((s) => s.id === stage)?.label ?? stage;
      addComment('job', jobId, `Stav změněn na ${label}`, true);
    },

    setJobCompany(jobId: string, name: string) {
      const job = state.pages.find((p) => p.id === jobId);
      if (!job) return;
      const companyId = ensureCompany(name, job.industry_id);
      update('pages', jobId, { company_id: companyId });
      const contact = state.contacts.find((c) => c.id === job.contact_id);
      if (companyId && contact && !contact.company_id) update('contacts', contact.id, { company_id: companyId });
    },

    setJobContact(jobId: string, name: string) {
      const job = state.pages.find((p) => p.id === jobId);
      if (!job) return;
      update('pages', jobId, { contact_id: ensureContact({ name, companyId: job.company_id }) });
    },

    setJobIndustry(jobId: string, industryId: string | null) {
      const job = state.pages.find((p) => p.id === jobId);
      if (!job) return;
      update('pages', jobId, { industry_id: industryId });
      const company = state.companies.find((c) => c.id === job.company_id);
      if (industryId && company && !company.industry_id) update('companies', company.id, { industry_id: industryId });
    },

    createCompany: (name = '') =>
      insert('companies', { name, industry_id: null, website: '', notes: '', created_by: userId }),

    createContact: (input: { name?: string; email?: string; phone?: string; companyName?: string; companyId?: string | null }) =>
      insert('contacts', {
        name: input.name?.trim() ?? '',
        company_id: input.companyId ?? ensureCompany(input.companyName),
        role: '',
        email: input.email ?? '',
        phone: input.phone ?? '',
        notes: '',
        created_by: userId,
      }),

    ensureContact,
    ensureCompany,

    createIdea: (text: string, productId: string | null = null): string =>
      insert('ideas', { text: text.trim(), notes: '', status: 'new', product_id: productId, tags: [], created_by: userId }),

    ideaToTask(idea: Idea): string {
      const pageId = idea.product_id ?? defaultProductId();
      createTask(pageId, null, undefined, null, { text: idea.text, notes: idea.notes, tags: idea.tags });
      finishIdea(idea);
      return pageId;
    },
    ideaToMilestone(idea: Idea): string {
      const id = createMilestone({ title: idea.text, product_id: idea.product_id, notes: idea.notes });
      finishIdea(idea);
      return id;
    },
    ideaToJob(idea: Idea): string {
      const id = createJob({ title: idea.text });
      finishIdea(idea);
      return id;
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

// Úkoly šablony jsou jen předloha, do přehledů a statistik nepatří.
export function liveTasks(workspace: Pick<WorkspaceData, 'tasks' | 'pages'>): Task[] {
  const templates = new Set(workspace.pages.filter((p) => p.kind === 'template').map((p) => p.id));
  return workspace.tasks.filter((t) => !templates.has(t.page_id));
}
