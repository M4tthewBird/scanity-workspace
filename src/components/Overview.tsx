import { byPosition } from '../lib/order';
import { pageHref } from '../lib/useRoute';
import type { Task } from '../lib/types';
import { useWorkspace } from '../lib/useWorkspace';
import { TaskChips } from './TaskChips';

function OverviewRow({ task, showPage, onOpen }: { task: Task; showPage: boolean; onOpen: (id: string) => void }) {
  const { pages, actions } = useWorkspace();
  const page = pages.find((p) => p.id === task.page_id);

  return (
    <div className="task-row overview-row">
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
          {page.icon} {page.title || 'Bez názvu'}
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

export function Overview({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const { tasks, pages } = useWorkspace();
  const pageOrder = new Map(pages.map((p) => [p.id, p.position]));
  const open = byPosition(tasks.filter((t) => !t.done)).sort(
    (a, b) => (pageOrder.get(a.page_id) ?? 0) - (pageOrder.get(b.page_id) ?? 0),
  );

  return (
    <article className="page">
      <h1 className="view-title">Přehled</h1>
      {open.length === 0 && <p className="empty">Žádné otevřené úkoly.</p>}
      {PRIORITY_GROUPS.map(({ key, title }) => {
        const group = open.filter((t) => t.priority === key);
        if (group.length === 0) return null;
        return (
          <section className="section" key={title}>
            <h2 className="group-title">
              {title} <span className="section-count">{group.length}</span>
            </h2>
            {group.map((task) => (
              <OverviewRow key={task.id} task={task} showPage onOpen={onOpenTask} />
            ))}
          </section>
        );
      })}
    </article>
  );
}

// Řazení podle termínu: ISO data jdou porovnat jako text, úkoly bez termínu patří na konec.
const dueRank = (due: string | null) => due ?? '9999-99-99';

export function MyTasks({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const { tasks, pages, me } = useWorkspace();
  const mine = tasks
    .filter((t) => !t.done && t.assignee === me.user_id)
    .sort((a, b) => dueRank(a.due).localeCompare(dueRank(b.due)) || a.position - b.position);
  // Díky seřazeným úkolům jdou stránky s nejbližším termínem první.
  const pageIds = [...new Set(mine.map((t) => t.page_id))];

  return (
    <article className="page">
      <h1 className="view-title">Moje úkoly</h1>
      {mine.length === 0 && <p className="empty">Nemáte žádné otevřené úkoly.</p>}
      {pageIds.map((pageId) => {
        const page = pages.find((p) => p.id === pageId);
        return (
          <section className="section" key={pageId}>
            <h2 className="group-title">
              <a href={pageHref(pageId)}>{page?.icon} {page?.title || 'Bez názvu'}</a>
            </h2>
            {mine
              .filter((t) => t.page_id === pageId)
              .map((task) => (
                <OverviewRow key={task.id} task={task} showPage={false} onOpen={onOpenTask} />
              ))}
          </section>
        );
      })}
    </article>
  );
}
