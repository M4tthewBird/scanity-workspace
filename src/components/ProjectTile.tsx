import { useEffect, useRef, useState } from 'react';
import { todayIso } from '../lib/format';
import { byPosition } from '../lib/order';
import { pageHref } from '../lib/useRoute';
import { PROJECT_STATES } from '../lib/types';
import type { Page, ProjectState } from '../lib/types';
import { liveTasks, useWorkspace } from '../lib/useWorkspace';
import { EditableText } from './EditableText';
import { Icon } from './Icon';

export const projectState = (page: Page): ProjectState => page.state ?? 'active';

function tasksLabel(open: number): string {
  if (open === 0) return 'Bez otevřených úkolů';
  if (open === 1) return '1 otevřený úkol';
  return `${open} ${open <= 4 ? 'otevřené úkoly' : 'otevřených úkolů'}`;
}

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && close();
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);
  return ref;
}

interface TileProps {
  page: Page;
  onMove: (direction: -1 | 1) => void;
  canMoveBack: boolean;
  canMoveForward: boolean;
}

function TileMenu({ page, onMove, canMoveBack, canMoveForward }: TileProps) {
  const { pages, actions } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const industries = byPosition(pages.filter((p) => p.kind === 'industry'));

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
          {page.kind === 'job' && (
            <label className="stack-field">
              Obor
              <select
                value={page.industry_id ?? ''}
                onChange={(e) => {
                  actions.setJobIndustry(page.id, e.target.value || null);
                  setOpen(false);
                }}
              >
                <option value="">Bez oboru</option>
                {industries.map((i) => (
                  <option key={i.id} value={i.id}>{i.title || 'Bez názvu'}</option>
                ))}
              </select>
            </label>
          )}
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

export function ProjectTile(props: TileProps) {
  const { page } = props;
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

  return (
    <article className={`project-tile is-${state}`}>
      <header className="project-head">
        <span className="project-icon" aria-hidden="true">{page.icon || '📄'}</span>
        <div className="project-name">
          <a className="project-title" href={pageHref(page.id)}>{page.title || 'Bez názvu'}</a>
          {who && <span className="project-who">{who}</span>}
        </div>
        <TileMenu {...props} />
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

      <footer className="project-foot">
        <select
          className={`state-pill is-${state}`}
          aria-label={`Stav: ${page.title || 'projekt'}`}
          value={state}
          onChange={(e) => actions.update('pages', page.id, { state: e.target.value as ProjectState })}
        >
          {PROJECT_STATES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <a className="project-meta" href={pageHref(page.id)}>
          {tasksLabel(open.length)}
          {overdue > 0 && <span className="is-overdue"> · {overdue} po termínu</span>}
        </a>
      </footer>
    </article>
  );
}

// Poslední dlaždice skupiny: připne existující projekt, nebo rovnou založí nový.
export function AddTile({ candidates, onPick, onCreate, noun }: {
  candidates: Page[];
  onPick: (id: string) => void;
  onCreate: (title: string) => void;
  noun: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const close = () => {
    setOpen(false);
    setTitle('');
  };
  const ref = useOutsideClose(open, close);

  if (!open) {
    return (
      <button type="button" className="project-tile project-add" onClick={() => setOpen(true)}>
        <Icon name="plus" size={18} /> Přidat {noun}
      </button>
    );
  }

  return (
    <div className="project-tile project-add is-picking" ref={ref}>
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
          placeholder={`Název nového projektu`}
          aria-label="Název nového projektu"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button className="btn-primary" disabled={!title.trim()}>Založit</button>
      </form>
      {candidates.length > 0 && (
        <select
          aria-label="Připnout existující"
          defaultValue=""
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
  );
}
