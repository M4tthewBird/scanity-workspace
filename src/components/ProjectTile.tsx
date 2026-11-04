import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { hasMeetings } from '../lib/api';
import { focusElement } from '../lib/focus';
import { todayIso } from '../lib/format';
import { groupOf, useProjectGroups } from '../lib/projectGroups';
import { pageHref } from '../lib/useRoute';
import { PROJECT_STATES } from '../lib/types';
import type { Meeting, Page, ProjectState } from '../lib/types';
import { liveTasks, useWorkspace } from '../lib/useWorkspace';
import { EditableText } from './EditableText';
import { Icon } from './Icon';

export const projectState = (page: Page): ProjectState => page.state ?? 'active';

// Probíhající meeting: poslední zahájený, který ještě nebyl ukončen.
export const activeMeeting = (meetings: Meeting[]): Meeting | undefined =>
  meetings.filter((m) => !m.ended_at).sort((a, b) => b.started_at.localeCompare(a.started_at))[0];

function tasksLabel(open: number): string {
  if (open === 0) return 'Bez otevřených úkolů';
  if (open === 1) return '1 otevřený úkol';
  return `${open} ${open <= 4 ? 'otevřené úkoly' : 'otevřených úkolů'}`;
}

export function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) closeRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && closeRef.current();
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);
  return ref;
}

interface TileProps {
  page: Page;
  onMove: (direction: -1 | 1) => void;
  canMoveBack: boolean;
  canMoveForward: boolean;
  dropHint: 'before' | 'after' | null;
  dragging: boolean;
  onDragStart: (event: ReactPointerEvent, page: Page) => void;
}

function TileMenu({ page, onMove, canMoveBack, canMoveForward }: Pick<TileProps, 'page' | 'onMove' | 'canMoveBack' | 'canMoveForward'>) {
  const { actions } = useWorkspace();
  const { options, move, duplicate, normalize } = useProjectGroups();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const current = normalize(groupOf(page));

  return (
    <div className="tile-menu" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label={`Upravit dlaždici ${page.title || 'projekt'}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="more" size={16} />
      </button>
      {open && (
        <div className="popover tile-popover">
          <label className="stack-field">
            Přesunout do
            <select
              value={current}
              onChange={(e) => {
                move(page.id, e.target.value);
                setOpen(false);
              }}
            >
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <label className="stack-field">
            Duplikovat do
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) duplicate(page.id, e.target.value);
                setOpen(false);
              }}
            >
              <option value="" disabled>Vyberte skupinu…</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <button type="button" className="btn-quiet" disabled={!canMoveBack} onClick={() => onMove(-1)}>
            <Icon name="back" size={16} /> Posunout dřív
          </button>
          <button type="button" className="btn-quiet flip-icon" disabled={!canMoveForward} onClick={() => onMove(1)}>
            <Icon name="back" size={16} /> Posunout později
          </button>
          <button type="button" className="btn-quiet" onClick={() => actions.update('pages', page.id, { pinned: false })}>
            <Icon name="close" size={16} /> Odebrat z přehledu
          </button>
        </div>
      )}
    </div>
  );
}

export function ProjectTile({ page, dropHint, dragging, onDragStart, ...menu }: TileProps) {
  const workspace = useWorkspace();
  const { contacts, companies, actions } = workspace;
  const state = projectState(page);
  const open = liveTasks(workspace).filter((t) => t.page_id === page.id && !t.done);
  const today = todayIso();
  const overdue = open.filter((t) => t.due && t.due < today).length;
  const contact = contacts.find((c) => c.id === page.contact_id);
  const company = companies.find((c) => c.id === page.company_id);
  const who =
    page.kind === 'job'
      ? [contact?.name, company && company.name !== page.title ? company.name : null].filter(Boolean).join(' · ')
      : '';
  const classes = ['project-tile', `is-${state}`, dragging && 'is-drag-source', dropHint && `drop-${dropHint}`];
  const meeting = activeMeeting(workspace.meetings);
  const notes = workspace.meeting_notes.filter((n) => n.page_id === page.id && n.body.trim());
  const latestNote = notes.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0];
  const inMeeting = meeting ? notes.filter((n) => n.meeting_id === meeting.id).length : 0;

  const addToMeeting = () => {
    if (!meeting) return;
    const id = actions.addMeetingNote(meeting.id, '', page.id);
    focusElement(`[data-meeting-note="${id}"]`);
  };

  return (
    <article className={classes.filter(Boolean).join(' ')} data-tile={page.id}>
      <header
        className="project-head"
        title="Přetáhněte pro přesun, s Alt nebo Ctrl pro kopii"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('.tile-menu')) return;
          onDragStart(event, page);
        }}
      >
        <span className="project-grip" aria-hidden="true"><Icon name="grip" size={14} /></span>
        <span className="project-icon" aria-hidden="true">{page.icon || '📄'}</span>
        <div className="project-name">
          <a className="project-title" href={pageHref(page.id)} draggable={false}>{page.title || 'Bez názvu'}</a>
          {who && <span className="project-who">{who}</span>}
        </div>
        <TileMenu page={page} {...menu} />
      </header>

      <EditableText
        className="project-status"
        placeholder="Napište, jak to teď vypadá…"
        aria-label={`Status: ${page.title || 'projekt'}`}
        multiline
        table="pages"
        rowId={page.id}
        value={page.status ?? ''}
        onValueChange={(status) => actions.update('pages', page.id, { status }, true)}
      />

      {latestNote && (
        <p className="project-note" title={latestNote.body}>
          <Icon name="note" size={13} /> {latestNote.body}
        </p>
      )}

      {meeting && (
        <button type="button" className={`tile-meeting ${inMeeting ? 'has-notes' : ''}`} onClick={addToMeeting}>
          <Icon name="plus" size={14} /> Do zápisu{inMeeting > 0 && ` · ${inMeeting}`}
        </button>
      )}

      <footer className="project-foot">
        <StatePill page={page} />
        <a className="project-meta" href={pageHref(page.id)} draggable={false}>
          {tasksLabel(open.length)}
          {overdue > 0 && <span className="is-overdue"> · {overdue} po termínu</span>}
        </a>
      </footer>
    </article>
  );
}

export function StatePill({ page }: { page: Page }) {
  const { actions } = useWorkspace();
  const state = projectState(page);
  // Hotovo potřebuje migration-006.sql, bez ní by zápis selhal na kontrole v databázi.
  const states = PROJECT_STATES.filter((s) => s.id !== 'done' || hasMeetings());
  return (
    <select
      className={`state-pill is-${state}`}
      aria-label={`Stav: ${page.title || 'projekt'}`}
      value={state}
      onChange={(e) => actions.update('pages', page.id, { state: e.target.value as ProjectState })}
    >
      {states.map((s) => (
        <option key={s.id} value={s.id}>{s.label}</option>
      ))}
    </select>
  );
}

// Plus vedle názvu skupiny: založí nový projekt, nebo připne existující.
export function AddButton({ candidates, onPick, onCreate, label }: {
  candidates: Page[];
  onPick: (id: string) => void;
  onCreate: (title: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const close = () => {
    setOpen(false);
    setTitle('');
  };
  const ref = useOutsideClose(open, close);

  return (
    <div className="add-button" ref={ref}>
      <button type="button" className="icon-btn group-add" aria-label={label} title={label} aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
        <Icon name="plus" size={16} />
      </button>
      {open && (
    <div className="popover add-popover">
      <form
        className="add-tile-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) onCreate(title.trim());
          close();
        }}
      >
        <input
          autoFocus
          placeholder="Název nového projektu"
          aria-label="Název nového projektu"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button className="btn-primary" disabled={!title.trim()}>Založit</button>
      </form>
      {candidates.length > 0 && (
        <select
          aria-label="Připnout existující"
          value=""
          onChange={(e) => {
            if (e.target.value) onPick(e.target.value);
            close();
          }}
        >
          <option value="" disabled>nebo připnout existující…</option>
          {candidates.map((p) => (
            <option key={p.id} value={p.id}>{p.title || 'Bez názvu'}</option>
          ))}
        </select>
      )}
    </div>
      )}
    </div>
  );
}
