import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { addDays, todayIso } from '../../lib/format';
import { byPosition } from '../../lib/order';
import { taskStatus } from '../../lib/types';
import type { Task } from '../../lib/types';
import { useWorkspace } from '../../lib/useWorkspace';
import type { ViewProps } from './types';

const DAY_PX = 30;
const PAD_BEFORE = 5;
const PAD_AFTER = 14;
const MIN_DAYS = 35;

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};
const span = (from: string, to: string) => dayNumber(to) - dayNumber(from);

function range(task: Task): [string, string] | null {
  const start = task.start ?? task.due;
  const end = task.due ?? task.start;
  if (!start || !end) return null;
  return start <= end ? [start, end] : [end, start];
}

interface BarDrag {
  id: string;
  mode: 'move' | 'end';
  startX: number;
  days: number;
}

export function TimelineView({ pageId, sectionId, tasks, newTaskAssignee, onOpenTask }: ViewProps) {
  const { actions } = useWorkspace();
  const [barDrag, setBarDrag] = useState<BarDrag | null>(null);
  const today = todayIso();
  const rows = byPosition(tasks);
  const ranges = rows.map(range).filter(Boolean) as [string, string][];

  const first = ranges.reduce((min, [s]) => (s < min ? s : min), today);
  const last = ranges.reduce((max, [, e]) => (e > max ? e : max), today);
  const from = addDays(first, -PAD_BEFORE);
  const days = Math.max(span(from, last) + PAD_AFTER, MIN_DAYS);
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const width = days * DAY_PX;

  const startBarDrag = (event: ReactPointerEvent, task: Task, mode: BarDrag['mode']) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const current = range(task);
    if (!current) return;
    let state: BarDrag = { id: task.id, mode, startX: event.clientX, days: 0 };
    setBarDrag(state);
    const onMove = (e: PointerEvent) => {
      state = { ...state, days: Math.round((e.clientX - state.startX) / DAY_PX) };
      setBarDrag(state);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setBarDrag(null);
      if (state.days === 0) {
        onOpenTask(task.id);
        return;
      }
      const [s, e] = current;
      if (mode === 'move') actions.update('tasks', task.id, { start: addDays(s, state.days), due: addDays(e, state.days) });
      else {
        const end = addDays(e, state.days);
        actions.update('tasks', task.id, { start: s, due: end < s ? s : end });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Klik do prázdného řádku úkolu bez data mu nastaví ten den.
  const placeAt = (event: React.MouseEvent<HTMLDivElement>, task: Task) => {
    if (range(task)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const day = addDays(from, Math.floor((event.clientX - rect.left) / DAY_PX));
    actions.update('tasks', task.id, { start: day, due: day });
  };

  return (
    <div className="timeline-wrap">
      <div className="timeline" style={{ gridTemplateColumns: `minmax(140px, 220px) ${width}px` }}>
        <div className="tl-corner" />
        <div className="tl-scale" style={{ width }}>
          {dates.map((d) => {
            const [, month, day] = d.split('-').map(Number);
            const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
            return (
              <span
                key={d}
                className={`tl-day ${d === today ? 'is-today' : ''} ${weekday === 0 || weekday === 6 ? 'is-weekend' : ''}`}
                style={{ width: DAY_PX }}
              >
                {day === 1 || d === from ? <strong>{day}. {month}.</strong> : day}
              </span>
            );
          })}
        </div>

        {rows.map((task) => {
          const r = range(task);
          const active = barDrag?.id === task.id ? barDrag : null;
          let left = 0;
          let length = 0;
          if (r) {
            left = span(from, r[0]) + (active?.mode === 'move' ? active.days : 0);
            length = Math.max(1, span(r[0], r[1]) + 1 + (active?.mode === 'end' ? active.days : 0));
          }
          return (
            <div className="tl-row" key={task.id}>
              <button type="button" className={`tl-label ${task.done ? 'is-done' : ''}`} onClick={() => onOpenTask(task.id)}>
                {task.text || 'Nový úkol'}
              </button>
              <div className={`tl-track ${r ? '' : 'is-empty'}`} style={{ width }} onClick={(e) => placeAt(e, task)}>
                <span className="tl-today" style={{ left: span(from, today) * DAY_PX + DAY_PX / 2 }} />
                {r ? (
                  <div
                    className={`tl-bar status-${taskStatus(task)} ${active ? 'is-dragging' : ''}`}
                    style={{ left: left * DAY_PX + 2, width: length * DAY_PX - 4 }}
                    title="Přetáhněte pro posun, za pravý okraj pro délku. Klik otevře detail."
                    onPointerDown={(e) => startBarDrag(e, task, 'move')}
                  >
                    <span>{task.text || 'Nový úkol'}</span>
                    <span className="tl-handle" onPointerDown={(e) => startBarDrag(e, task, 'end')} />
                  </div>
                ) : (
                  <span className="tl-hint">Klikněte na den</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="add-task"
        onClick={() =>
          onOpenTask(actions.createTask(pageId, sectionId, rows.at(-1)?.id, newTaskAssignee, { start: today, due: addDays(today, 2) }))
        }
      >
        + Přidat úkol
      </button>
    </div>
  );
}
