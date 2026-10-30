import { useEffect, useRef, useState } from 'react';
import { addDays, formatDue, todayIso } from '../lib/format';
import { byPosition } from '../lib/order';
import type { Milestone } from '../lib/types';
import { liveTasks, useWorkspace } from '../lib/useWorkspace';
import { Comments } from './Comments';
import { EditableText } from './EditableText';
import { Field } from './Fields';
import { Icon } from './Icon';
import { DevNav } from './Vyvoj';

const PX_PER_DAY = 5;
const MIN_BAR_PX = 14;
const LOOK_BEHIND_MONTHS = 1;
const LOOK_AHEAD_MONTHS = 6;
const DEFAULT_LENGTH_DAYS = 30;

export function DevDrawerHint({ text }: { text: string }) {
  return <p className="empty-note">{text}</p>;
}

const toDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

function monthsBetween(startIso: string, endIso: string): { iso: string; label: string }[] {
  const months = [];
  const end = new Date(`${endIso}T00:00:00Z`);
  const cursor = new Date(`${startIso.slice(0, 7)}-01T00:00:00Z`);
  while (cursor <= end) {
    months.push({
      iso: cursor.toISOString().slice(0, 10),
      label: cursor.toLocaleDateString('cs-CZ', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function monthOffset(iso: string, months: number): string {
  const date = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function MilestoneDrawer({ item, onClose }: { item: Milestone; onClose: () => void }) {
  const workspace = useWorkspace();
  const { pages, actions } = workspace;
  const linked = liveTasks(workspace).filter((t) => t.milestone_id === item.id);
  const done = linked.filter((t) => t.done).length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" aria-label="Položka roadmapy">
        <div className="drawer-top">
          <span className="drawer-kicker-text">{linked.length > 0 ? `${done}/${linked.length} úkolů hotovo` : 'Žádné připojené úkoly'}</span>
          <button type="button" className="icon-btn" aria-label="Zavřít" onClick={onClose}><Icon name="close" /></button>
        </div>
        <EditableText
          className="drawer-title"
          placeholder="Název položky"
          aria-label="Název položky"
          data-milestone-title={item.id}
          table="milestones"
          rowId={item.id}
          value={item.title}
          onValueChange={(title) => actions.update('milestones', item.id, { title }, true)}
        />
        <div className="drawer-fields">
          <Field label="Produkt">
            <select value={item.product_id ?? ''} onChange={(e) => actions.update('milestones', item.id, { product_id: e.target.value || null })}>
              <option value="">Obecné</option>
              {byPosition(pages.filter((p) => p.kind === 'product')).map((p) => (
                <option key={p.id} value={p.id}>{p.title || 'Bez názvu'}</option>
              ))}
            </select>
          </Field>
          <Field label="Začátek">
            <input
              type="date"
              value={item.start_date ?? ''}
              onChange={(e) => {
                const start = e.target.value || null;
                const end = start && item.end_date && item.end_date < start ? start : item.end_date;
                actions.update('milestones', item.id, { start_date: start, end_date: end });
              }}
            />
          </Field>
          <Field label="Konec">
            <input
              type="date"
              min={item.start_date ?? undefined}
              value={item.end_date ?? ''}
              onChange={(e) => actions.update('milestones', item.id, { end_date: e.target.value || null })}
            />
          </Field>
        </div>
        <EditableText
          className="notes-area"
          placeholder="Poznámky…"
          aria-label="Poznámky"
          multiline
          table="milestones"
          rowId={item.id}
          value={item.notes ?? ''}
          onValueChange={(notes) => actions.update('milestones', item.id, { notes }, true)}
        />
        {linked.length > 0 && (
          <section className="linked-tasks">
            <h3>Připojené úkoly</h3>
            {linked.map((task) => (
              <label className="linked-task" key={task.id}>
                <input
                  type="checkbox"
                  className="task-check"
                  checked={task.done}
                  onChange={(e) => actions.update('tasks', task.id, { done: e.target.checked })}
                />
                <span className={task.done ? 'is-struck' : ''}>{task.text || 'Nový úkol'}</span>
              </label>
            ))}
          </section>
        )}
        <Comments type="milestone" id={item.id} />
        <footer className="drawer-footer">
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              if (window.confirm('Smazat tuto položku roadmapy? Úkoly zůstanou, jen se od ní odpojí.')) {
                actions.remove('milestones', item.id);
                onClose();
              }
            }}
          >
            Smazat položku
          </button>
        </footer>
      </aside>
    </>
  );
}

export function Roadmap() {
  const workspace = useWorkspace();
  const { pages, milestones, actions } = workspace;
  const [openId, setOpenId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = todayIso();
  const tasks = liveTasks(workspace);

  const dated = milestones.filter((m) => m.start_date || m.end_date);
  const undated = byPosition(milestones.filter((m) => !m.start_date && !m.end_date));
  const startOf = (m: Milestone) => (m.start_date ?? m.end_date)!;
  const endOf = (m: Milestone) => (m.end_date ?? m.start_date)!;

  const from = [monthOffset(today, -LOOK_BEHIND_MONTHS), ...dated.map(startOf)].sort()[0].slice(0, 7) + '-01';
  const lastDay = [monthOffset(today, LOOK_AHEAD_MONTHS), ...dated.map(endOf)].sort().at(-1)!;
  const to = addDays(monthOffset(lastDay, 1), -1);
  const months = monthsBetween(from, to);
  const x = (iso: string) => (toDay(iso) - toDay(from)) * PX_PER_DAY;
  const width = x(to) + PX_PER_DAY;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, x(today) - 120);
    // Jen při otevření: později by to uživateli přeskakovalo pod rukama.
  }, []);

  const products = byPosition(pages.filter((p) => p.kind === 'product'));
  const groups = [
    ...products.map((p) => ({ key: p.id, title: p.title || 'Bez názvu', items: dated.filter((m) => m.product_id === p.id) })),
    { key: 'none', title: 'Obecné', items: dated.filter((m) => !m.product_id) },
  ].filter((g) => g.items.length > 0);

  const progress = (id: string) => {
    const linked = tasks.filter((t) => t.milestone_id === id);
    return linked.length ? (linked.filter((t) => t.done).length / linked.length) * 100 : 0;
  };

  const add = () => {
    const id = actions.createMilestone({ start_date: today, end_date: addDays(today, DEFAULT_LENGTH_DAYS) });
    setOpenId(id);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-milestone-title="${id}"]`)?.focus());
  };

  const open = milestones.find((m) => m.id === openId);

  return (
    <div className="view view-wide">
      <DevNav active="roadmap" />
      <div className="toolbar">
        <h1>Roadmapa</h1>
        <button type="button" className="btn-secondary" onClick={add}><Icon name="plus" size={16} /> Položka</button>
      </div>

      <div className="timeline" ref={scrollRef}>
        <div className="timeline-inner" style={{ width: width + 180 }}>
          <div className="timeline-months">
            <div className="timeline-label timeline-corner" />
            <div className="timeline-track" style={{ width }}>
              {months.map((m) => (
                <span className="timeline-month" key={m.iso} style={{ left: x(m.iso) }}>{m.label}</span>
              ))}
            </div>
          </div>
          <div className="timeline-today" style={{ left: 180 + x(today) }} aria-hidden="true" />
          {groups.length === 0 && (
            <p className="timeline-empty">Na ose zatím nic není. Přidejte položku nebo doplňte termín položce níže.</p>
          )}
          {groups.map((group) => (
            <div key={group.key}>
              <div className="timeline-group"><span className="timeline-label">{group.title}</span></div>
              {byPosition(group.items).map((item) => {
                const left = x(startOf(item));
                const barWidth = Math.max(MIN_BAR_PX, x(endOf(item)) - left + PX_PER_DAY);
                return (
                  <div className="timeline-row" key={item.id}>
                    <button type="button" className="timeline-label timeline-name" onClick={() => setOpenId(item.id)}>
                      {item.title || 'Bez názvu'}
                    </button>
                    <div className="timeline-track" style={{ width }}>
                      <button
                        type="button"
                        className="timeline-bar"
                        style={{ left, width: barWidth }}
                        title={`${item.title}: ${formatDue(startOf(item))} až ${formatDue(endOf(item))}`}
                        aria-label={`${item.title || 'Bez názvu'}, ${formatDue(startOf(item))} až ${formatDue(endOf(item))}`}
                        onClick={() => setOpenId(item.id)}
                      >
                        <span className="timeline-fill" style={{ width: `${progress(item.id)}%` }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {undated.length > 0 && (
        <section className="task-group">
          <h2 className="group-title">Bez termínu <span className="count">{undated.length}</span></h2>
          {undated.map((item) => (
            <button type="button" className="undated-row" key={item.id} onClick={() => setOpenId(item.id)}>
              <span>{item.title || 'Bez názvu'}</span>
              <span className="muted">{pages.find((p) => p.id === item.product_id)?.title ?? 'Obecné'}</span>
              <span className="undated-action">Nastavit termín</span>
            </button>
          ))}
        </section>
      )}

      {open && <MilestoneDrawer key={open.id} item={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}
