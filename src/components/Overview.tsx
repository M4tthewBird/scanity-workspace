import { useState } from 'react';
import { downloadCsv } from '../lib/csv';
import { byPosition } from '../lib/order';
import { pageHref } from '../lib/useRoute';
import type { Task } from '../lib/types';
import { liveTasks, useWorkspace } from '../lib/useWorkspace';
import { ExportButton } from './Fields';
import { DevNav } from './Vyvoj';
import { TaskChips } from './TaskChips';

export function TaskListRow({ task, showPage, onOpen }: { task: Task; showPage: boolean; onOpen: (id: string) => void }) {
  const { pages, actions } = useWorkspace();
  const page = pages.find((p) => p.id === task.page_id);

  return (
    <div className={`task-row overview-row ${task.done ? 'is-done' : ''}`}>
      <input
        type="checkbox"
        className="task-check"
        aria-label="Označit jako hotové"
        checked={task.done}
        onChange={(e) => actions.update('tasks', task.id, { done: e.target.checked })}
      />
      <button type="button" className="overview-text" onClick={() => onOpen(task.id)}>
        {task.text || <span className="muted">Nový úkol</span>}
      </button>
      {showPage && page && (
        <a className="page-tag" href={pageHref(page.id)}>
          {page.title || 'Bez názvu'}
        </a>
      )}
      <TaskChips task={task} />
    </div>
  );
}

const PRIORITY_GROUPS = [
  { key: 'P1', title: 'P1' },
  { key: 'P2', title: 'P2' },
  { key: 'P3', title: 'P3' },
  { key: null, title: 'Bez priority' },
] as const;

export function AllTasks({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const workspace = useWorkspace();
  const { pages, members } = workspace;
  const [assignee, setAssignee] = useState('');
  const [tag, setTag] = useState('');
  const tasks = liveTasks(workspace);
  const tags = [...new Set(tasks.flatMap((t) => t.tags ?? []))].sort();
  const pageOrder = new Map(pages.map((p) => [p.id, p.position]));
  const open = byPosition(
    tasks.filter((t) => !t.done && (!assignee || t.assignee === assignee) && (!tag || t.tags?.includes(tag))),
  ).sort((a, b) => (pageOrder.get(a.page_id) ?? 0) - (pageOrder.get(b.page_id) ?? 0));

  const exportCsv = () =>
    downloadCsv(
      'scanity-ukoly.csv',
      ['Úkol', 'Stránka', 'Hotovo', 'Priorita', 'Přiřazeno', 'Termín', 'Štítky', 'Poznámky'],
      tasks.map((t) => [
        t.text,
        pages.find((p) => p.id === t.page_id)?.title,
        t.done,
        t.priority,
        members.find((m) => m.user_id === t.assignee)?.name,
        t.due,
        t.tags,
        t.notes,
      ]),
    );

  return (
    <div className="view">
      <DevNav active="tasks" />
      <div className="toolbar">
        <h1>Všechny otevřené úkoly</h1>
        <select aria-label="Filtr podle člověka" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Všichni</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>{m.name}</option>
          ))}
        </select>
        {tags.length > 0 && (
          <select aria-label="Filtr podle štítku" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Všechny štítky</option>
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
        <ExportButton onClick={exportCsv} />
      </div>
      {open.length === 0 && <p className="empty-note">Tomuhle filtru neodpovídá žádný otevřený úkol.</p>}
      {PRIORITY_GROUPS.map(({ key, title }) => {
        const group = open.filter((t) => t.priority === key);
        if (group.length === 0) return null;
        return (
          <section className="task-group" key={title}>
            <h2 className="group-title">
              {title} <span className="count">{group.length}</span>
            </h2>
            {group.map((task) => (
              <TaskListRow key={task.id} task={task} showPage onOpen={onOpenTask} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
