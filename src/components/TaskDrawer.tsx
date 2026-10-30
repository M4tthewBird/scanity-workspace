import { useEffect } from 'react';
import { formatDateTime } from '../lib/format';
import { byPosition } from '../lib/order';
import type { Priority, Task } from '../lib/types';
import { useWorkspace } from '../lib/useWorkspace';
import { Comments } from './Comments';
import { EditableText } from './EditableText';
import { TagInput } from './Fields';
import { Icon } from './Icon';

export function TaskDrawer({ task, onClose }: { task: Task; onClose: () => void }) {
  const { pages, sections, members, milestones, actions } = useWorkspace();
  const pageSections = byPosition(sections.filter((s) => s.page_id === task.page_id));
  const author = members.find((m) => m.user_id === task.created_by);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const deleteTask = () => {
    if (window.confirm('Smazat tento úkol? Tuto akci nelze vrátit.')) {
      actions.deleteTask(task.id);
      onClose();
    }
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" aria-label="Detail úkolu">
        <div className="drawer-top">
          <label className="drawer-done">
            <input
              type="checkbox"
              className="task-check"
              checked={task.done}
              onChange={(e) => actions.update('tasks', task.id, { done: e.target.checked })}
            />
            {task.done ? 'Hotovo' : 'Otevřené'}
          </label>
          <button type="button" className="icon-btn" aria-label="Zavřít detail" onClick={onClose}><Icon name="close" /></button>
        </div>

        <EditableText
          className="drawer-title"
          placeholder="Nový úkol"
          aria-label="Text úkolu"
          table="tasks"
          rowId={task.id}
          value={task.text}
          onValueChange={(text) => actions.update('tasks', task.id, { text }, true)}
        />

        <div className="drawer-fields">
          <label className="field-row">
            <span>Stránka</span>
            <select value={task.page_id} onChange={(e) => actions.moveTaskToPage(task.id, e.target.value)}>
              {byPosition(pages.filter((p) => p.kind !== 'template')).map((p) => (
                <option key={p.id} value={p.id}>{p.title || 'Bez názvu'}</option>
              ))}
            </select>
          </label>
          <label className="field-row">
            <span>Sekce</span>
            <select
              value={task.section_id ?? ''}
              onChange={(e) => actions.moveTask(task.id, e.target.value || null, null, false)}
            >
              <option value="">Bez sekce</option>
              {pageSections.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </label>
          <label className="field-row">
            <span>Priorita</span>
            <select
              value={task.priority ?? ''}
              onChange={(e) => actions.update('tasks', task.id, { priority: (e.target.value || null) as Priority | null })}
            >
              <option value="">Bez priority</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
            </select>
          </label>
          <label className="field-row">
            <span>Přiřazeno</span>
            <select
              value={task.assignee ?? ''}
              onChange={(e) => actions.update('tasks', task.id, { assignee: e.target.value || null })}
            >
              <option value="">Nepřiřazeno</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.name}</option>
              ))}
            </select>
          </label>
          <label className="field-row">
            <span>Termín</span>
            <input
              type="date"
              value={task.due ?? ''}
              onChange={(e) => actions.update('tasks', task.id, { due: e.target.value || null })}
            />
          </label>
          <label className="field-row">
            <span>Roadmapa</span>
            <select
              value={task.milestone_id ?? ''}
              onChange={(e) => actions.update('tasks', task.id, { milestone_id: e.target.value || null })}
            >
              <option value="">Nepřipojeno</option>
              {byPosition(milestones).map((m) => (
                <option key={m.id} value={m.id}>{m.title || 'Bez názvu'}</option>
              ))}
            </select>
          </label>
          <div className="field-row">
            <span>Štítky</span>
            <TagInput tags={task.tags} onChange={(tags) => actions.update('tasks', task.id, { tags })} />
          </div>
        </div>

        <label className="drawer-notes-label" htmlFor="task-notes">Poznámky</label>
        <EditableText
          id="task-notes"
          className="drawer-notes"
          placeholder="Přidat poznámku…"
          multiline
          table="tasks"
          rowId={task.id}
          value={task.notes ?? ''}
          onValueChange={(notes) => actions.update('tasks', task.id, { notes }, true)}
        />

        <Comments type="task" id={task.id} />

        <footer className="drawer-footer">
          <p>
            Vytvořil(a) {author?.name ?? 'neznámý člen'}
            {task.created_at && <>, {formatDateTime(task.created_at)}</>}
          </p>
          <button type="button" className="btn-danger" onClick={deleteTask}>Smazat úkol</button>
        </footer>
      </aside>
    </>
  );
}
