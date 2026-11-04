import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { focusElement } from '../lib/focus';
import { byPosition } from '../lib/order';
import { pageHref } from '../lib/useRoute';
import type { Meeting, MeetingNote, Page } from '../lib/types';
import { useWorkspace } from '../lib/useWorkspace';
import { EditableText } from './EditableText';
import { Icon } from './Icon';
import { activeMeeting } from './ProjectTile';

const PAST_SIZE = 5;
const TICK_MS = 30_000;

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
}

function formatMeetingDate(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Projekty, ke kterým jde bod přiřadit: připnuté nahoře, pak ostatní zakázky a produkty.
function useProjectOptions(): Page[] {
  const { pages } = useWorkspace();
  const projects = pages.filter((p) => (p.kind === 'job' || p.kind === 'product') && p.state !== 'done');
  return [...byPosition(projects.filter((p) => p.pinned)), ...byPosition(projects.filter((p) => !p.pinned))];
}

function ProjectSelect({ value, onChange, className }: { value: string | null; onChange: (id: string | null) => void; className?: string }) {
  const projects = useProjectOptions();
  const pinned = projects.filter((p) => p.pinned);
  const rest = projects.filter((p) => !p.pinned);
  return (
    <select
      className={`project-select ${value ? 'has-value' : ''} ${className ?? ''}`}
      aria-label="Projekt"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">Bez projektu</option>
      <optgroup label="Na Přehledu">
        {pinned.map((p) => <option key={p.id} value={p.id}>{p.title || 'Bez názvu'}</option>)}
      </optgroup>
      {rest.length > 0 && (
        <optgroup label="Ostatní">
          {rest.map((p) => <option key={p.id} value={p.id}>{p.title || 'Bez názvu'}</option>)}
        </optgroup>
      )}
    </select>
  );
}

// Bod zápisu: text, projekt a převod na úkol do toho projektu.
export function NoteRow({ note, showProject = true, showMeeting }: { note: MeetingNote; showProject?: boolean; showMeeting?: Meeting }) {
  const { tasks, actions } = useWorkspace();
  const converted = tasks.some((t) => t.page_id === note.page_id && t.text === note.body && t.notes === 'Z meetingu');

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      const id = actions.addMeetingNote(note.meeting_id, '', note.page_id);
      focusElement(`[data-meeting-note="${id}"]`);
    } else if (event.key === 'Backspace' && event.currentTarget.value === '') {
      event.preventDefault();
      actions.remove('meeting_notes', note.id);
    }
  };

  return (
    <li className="note-row">
      <EditableText
        className="note-text"
        placeholder="Bod zápisu…"
        aria-label="Bod zápisu"
        data-meeting-note={note.id}
        table="meeting_notes"
        rowId={note.id}
        value={note.body}
        onValueChange={(body) => actions.update('meeting_notes', note.id, { body }, true)}
        onKeyDown={onKeyDown}
      />
      <div className="note-meta">
        {showMeeting && <span className="note-when">{showMeeting.title || 'Meeting'} · {formatMeetingDate(showMeeting.started_at)}</span>}
        {showProject && (
          <ProjectSelect value={note.page_id} onChange={(page_id) => actions.update('meeting_notes', note.id, { page_id })} />
        )}
        {note.page_id && showProject && (
          <a className="icon-btn" href={pageHref(note.page_id)} aria-label="Otevřít projekt" title="Otevřít projekt">
            <Icon name="open" size={14} />
          </a>
        )}
        {note.page_id && note.body.trim() && (
          <button
            type="button"
            className={`btn-quiet note-task ${converted ? 'is-done' : ''}`}
            disabled={converted}
            onClick={() => actions.meetingNoteToTask(note.id)}
            title="Vytvořit úkol v přiřazeném projektu"
          >
            {converted ? <><Icon name="check" size={14} /> Úkol</> : '→ Úkol'}
          </button>
        )}
      </div>
    </li>
  );
}

function MeetingNotes({ meeting }: { meeting: Meeting }) {
  const { meeting_notes, actions } = useWorkspace();
  const [draft, setDraft] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const notes = byPosition(meeting_notes.filter((n) => n.meeting_id === meeting.id));

  const add = () => {
    if (!draft.trim()) return;
    actions.addMeetingNote(meeting.id, draft.trim(), projectId);
    setDraft('');
  };

  return (
    <>
      {notes.length > 0 && (
        <ul className="note-list">
          {notes.map((note) => <NoteRow key={note.id} note={note} />)}
        </ul>
      )}
      <form
        className="note-composer"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          placeholder="Napište bod a Enter…"
          aria-label="Nový bod zápisu"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        {/* Projekt zůstává vybraný pro další body, většinou se probírá jeden projekt po druhém. */}
        <ProjectSelect value={projectId} onChange={setProjectId} />
      </form>
    </>
  );
}

export function MeetingCard() {
  const { meetings, meeting_notes, actions } = useWorkspace();
  const [openId, setOpenId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const active = activeMeeting(meetings);
  const past = meetings
    .filter((m) => m.ended_at)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, PAST_SIZE);
  const opened = past.find((m) => m.id === openId);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(timer);
  }, [active]);

  const noteCount = (id: string) => meeting_notes.filter((n) => n.meeting_id === id && n.body.trim()).length;
  const deleteMeeting = (meeting: Meeting) => {
    const count = noteCount(meeting.id);
    if (count === 0 || window.confirm(`Smazat „${meeting.title || 'Meeting'}“ i s body zápisu (počet: ${count})?`)) {
      actions.deleteMeeting(meeting.id);
      setOpenId(null);
    }
  };

  return (
    <section className={`dash-block meeting-card ${active ? 'is-live' : ''}`}>
      <h2>
        Meeting
        {active && <span className="live-dot">běží {minutesSince(active.started_at)} min</span>}
      </h2>

      {active ? (
        <>
          <div className="meeting-head">
            <EditableText
              className="meeting-title"
              placeholder="Název meetingu"
              aria-label="Název meetingu"
              table="meetings"
              rowId={active.id}
              value={active.title}
              onValueChange={(title) => actions.update('meetings', active.id, { title }, true)}
            />
            <button type="button" className="btn-secondary" onClick={() => actions.endMeeting(active.id)}>Ukončit</button>
          </div>
          <MeetingNotes meeting={active} />
          <p className="form-hint">Bod přiřaďte k projektu a objeví se na jeho dlaždici i stránce. Na dlaždicích je teď tlačítko Do zápisu.</p>
        </>
      ) : (
        <button type="button" className="btn-primary meeting-start" onClick={() => actions.startMeeting()}>
          <Icon name="play" size={14} /> Zahájit meeting
        </button>
      )}

      {past.length > 0 && (
        <ol className="meeting-history">
          {past.map((m) => (
            <li key={m.id} className={openId === m.id ? 'is-open' : ''}>
              <button type="button" className="meeting-history-row" aria-expanded={openId === m.id} onClick={() => setOpenId(openId === m.id ? null : m.id)}>
                <span>{m.title || 'Meeting'}</span>
                <span className="feed-meta">{formatMeetingDate(m.started_at)} · {noteCount(m.id)} bodů</span>
              </button>
              {opened?.id === m.id && (
                <div className="meeting-past">
                  <MeetingNotes meeting={m} />
                  <button type="button" className="btn-quiet" onClick={() => deleteMeeting(m)}>
                    <Icon name="trash" size={14} /> Smazat meeting
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// Na stránce projektu: všechny body z meetingů, které k němu patří.
export function ProjectMeetingNotes({ page }: { page: Page }) {
  const { meetings, meeting_notes } = useWorkspace();
  const notes = meeting_notes
    .filter((n) => n.page_id === page.id && n.body.trim())
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  if (notes.length === 0) return null;

  return (
    <section className="project-meetings">
      <h3>Z meetingů <span className="count">{notes.length}</span></h3>
      <ul className="note-list">
        {notes.map((note) => (
          <NoteRow key={note.id} note={note} showProject={false} showMeeting={meetings.find((m) => m.id === note.meeting_id)} />
        ))}
      </ul>
    </section>
  );
}
