import { useEffect, useState } from 'react';
import { focusElement } from '../lib/focus';
import { todayIso } from '../lib/format';
import { byPosition } from '../lib/order';
import { useProjectGroups } from '../lib/projectGroups';
import { pageHref } from '../lib/useRoute';
import type { Meeting, MeetingNote, Page } from '../lib/types';
import { liveTasks, useWorkspace } from '../lib/useWorkspace';
import { EditableText } from './EditableText';
import { Icon } from './Icon';
import { formatMeetingDate, minutesSince, NoteRow } from './Meetings';
import { StatePill } from './ProjectTile';

const TICK_MS = 30_000;

function tasksLabel(open: number, overdue: number): string {
  const base = open === 0 ? 'bez otevřených úkolů' : open === 1 ? '1 otevřený úkol' : `${open} ${open <= 4 ? 'otevřené úkoly' : 'otevřených úkolů'}`;
  return overdue > 0 ? `${base}, ${overdue} po termínu` : base;
}

// Jeden blok zápisu: projekt s jeho stavem a statusem nahoře, pod tím body z tohoto meetingu.
function ProjectBlock({ meeting, page, notes, onOpenTask }: {
  meeting: Meeting;
  page: Page | null;
  notes: MeetingNote[];
  onOpenTask: (id: string) => void;
}) {
  const workspace = useWorkspace();
  const { actions } = workspace;
  const pageId = page?.id ?? null;
  const today = todayIso();
  const open = page ? liveTasks(workspace).filter((t) => t.page_id === page.id && !t.done) : [];
  const overdue = open.filter((t) => t.due && t.due < today).length;
  const fromMeeting = page
    ? workspace.tasks.filter((t) => t.page_id === page.id && t.notes === 'Z meetingu' && notes.some((n) => n.body === t.text))
    : [];

  const addNote = () => {
    const id = actions.addMeetingNote(meeting.id, '', pageId);
    focusElement(`[data-meeting-note="${id}"]`);
  };

  const removeBlock = () => {
    const filled = notes.filter((n) => n.body.trim()).length;
    const name = page?.title || 'Bez názvu';
    if (filled === 0 || window.confirm(`Odebrat „${name}“ z meetingu i s body zápisu (počet: ${filled})?`)) {
      for (const note of notes) actions.remove('meeting_notes', note.id);
    }
  };

  return (
    <section className="room-block" data-room-block={pageId ?? 'general'}>
      <header className="room-block-head">
        {page ? (
          <>
            <span className="project-icon" aria-hidden="true">{page.icon || '📄'}</span>
            <div className="room-block-name">
              <a className="room-block-title" href={pageHref(page.id)}>{page.title || 'Bez názvu'}</a>
              <span className="project-who">{tasksLabel(open.length, overdue)}</span>
            </div>
            <StatePill page={page} />
            <button type="button" className="icon-btn" aria-label={`Odebrat ${page.title || 'projekt'} z meetingu`} title="Odebrat z meetingu" onClick={removeBlock}>
              <Icon name="close" size={15} />
            </button>
          </>
        ) : (
          <div className="room-block-name">
            <h2 className="room-block-title">Obecné</h2>
            <span className="project-who">Body bez projektu</span>
          </div>
        )}
      </header>

      {page && (
        <EditableText
          className="room-status"
          placeholder="Status projektu: jak to teď vypadá…"
          aria-label={`Status: ${page.title || 'projekt'}`}
          multiline
          table="pages"
          rowId={page.id}
          value={page.status ?? ''}
          onValueChange={(status) => actions.update('pages', page.id, { status }, true)}
        />
      )}

      <ul className="note-list room-notes">
        {notes.map((note) => <NoteRow key={note.id} note={note} showProject={false} />)}
      </ul>
      <button type="button" className="add-task room-add" onClick={addNote}>+ Poznámka</button>

      {fromMeeting.length > 0 && (
        <div className="room-tasks">
          {fromMeeting.map((task) => (
            <button type="button" key={task.id} className="room-task" onClick={() => onOpenTask(task.id)}>
              <Icon name="check" size={13} /> Úkol: {task.text}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function MeetingRoom({ id, onOpenTask }: { id: string; onOpenTask: (id: string) => void }) {
  const { meetings, meeting_notes, pages, actions } = useWorkspace();
  const { options, pinnedIn } = useProjectGroups();
  const [, setTick] = useState(0);
  const meeting = meetings.find((m) => m.id === id);
  const live = Boolean(meeting && !meeting.ended_at);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(timer);
  }, [live]);

  if (!meeting) {
    return (
      <div className="empty">
        <p>Tento meeting neexistuje nebo byl smazán.</p>
        <a href="#/">Zpět na přehled</a>
      </div>
    );
  }

  const notes = byPosition(meeting_notes.filter((n) => n.meeting_id === meeting.id));
  // Pořadí projektů podle prvního bodu: jak se o nich na meetingu mluvilo.
  const order: string[] = [];
  for (const note of notes) if (note.page_id && !order.includes(note.page_id)) order.push(note.page_id);
  const blocks = order.map((pid) => ({ page: pages.find((p) => p.id === pid) ?? null, pid }));
  const general = notes.filter((n) => !n.page_id || !pages.some((p) => p.id === n.page_id));
  const inMeeting = new Set(order);

  const addProject = (pageId: string) => {
    if (inMeeting.has(pageId)) {
      document.querySelector(`[data-room-block="${pageId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const noteId = actions.addMeetingNote(meeting.id, '', pageId);
    focusElement(`[data-meeting-note="${noteId}"]`);
  };

  const others = pages
    .filter((p) => (p.kind === 'job' || p.kind === 'product') && !p.pinned && p.state !== 'done')
    .sort((a, b) => a.title.localeCompare(b.title, 'cs'));

  const deleteMeeting = () => {
    const count = notes.filter((n) => n.body.trim()).length;
    if (window.confirm(`Smazat „${meeting.title || 'Meeting'}“ i s body zápisu (počet: ${count})? Tuto akci nelze vrátit.`)) {
      actions.deleteMeeting(meeting.id);
      location.hash = '#/';
    }
  };

  return (
    <div className="view room">
      <a className="back-link" href="#/"><Icon name="back" size={16} /> Přehled</a>

      <header className="room-head">
        <div className="room-heading">
          <EditableText
            className="page-title"
            placeholder="Název meetingu"
            aria-label="Název meetingu"
            table="meetings"
            rowId={meeting.id}
            value={meeting.title}
            onValueChange={(title) => actions.update('meetings', meeting.id, { title }, true)}
          />
          <p className="room-when">
            {formatMeetingDate(meeting.started_at)}
            {live ? <span className="live-dot">běží {minutesSince(meeting.started_at)} min</span> : ' · ukončeno'}
          </p>
        </div>
        <div className="room-actions">
          {live ? (
            <button type="button" className="btn-primary" onClick={() => actions.endMeeting(meeting.id)}>Ukončit meeting</button>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => actions.update('meetings', meeting.id, { ended_at: null })}>Pokračovat</button>
          )}
          <button type="button" className="icon-btn" aria-label="Smazat meeting" title="Smazat meeting" onClick={deleteMeeting}>
            <Icon name="trash" />
          </button>
        </div>
      </header>

      <div className="room-grid">
        <div className="room-main">
          <ProjectBlock meeting={meeting} page={null} notes={general} onOpenTask={onOpenTask} />
          {blocks.map(({ page, pid }) => (
            <ProjectBlock key={pid} meeting={meeting} page={page} notes={notes.filter((n) => n.page_id === pid)} onOpenTask={onOpenTask} />
          ))}
          {blocks.length === 0 && (
            <p className="empty-note room-empty">Vyberte vpravo projekty, které probíráte. Každý dostane vlastní blok pro poznámky.</p>
          )}
        </div>

        <aside className="room-side">
          <h2>Projekty</h2>
          {options.map((group) => {
            const items = pinnedIn(group.id);
            if (items.length === 0) return null;
            return (
              <div className="room-group" key={group.id}>
                <h3>{group.label}</h3>
                {items.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className={`room-pick ${inMeeting.has(p.id) ? 'is-in' : ''}`}
                    aria-pressed={inMeeting.has(p.id)}
                    onClick={() => addProject(p.id)}
                  >
                    <span aria-hidden="true">{p.icon || '📄'}</span>
                    <span className="room-pick-title">{p.title || 'Bez názvu'}</span>
                    <Icon name={inMeeting.has(p.id) ? 'check' : 'plus'} size={14} />
                  </button>
                ))}
              </div>
            );
          })}
          {others.length > 0 && (
            <select
              className="room-other"
              aria-label="Přidat jiný projekt"
              value=""
              onChange={(e) => e.target.value && addProject(e.target.value)}
            >
              <option value="" disabled>Jiný projekt…</option>
              {others.map((p) => <option key={p.id} value={p.id}>{p.title || 'Bez názvu'}</option>)}
            </select>
          )}
        </aside>
      </div>
    </div>
  );
}
