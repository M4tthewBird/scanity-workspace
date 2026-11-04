import { focusTask } from '../../lib/focus';
import { byPosition } from '../../lib/order';
import { TASK_STATUSES, taskStatus } from '../../lib/types';
import type { Priority, TaskStatus } from '../../lib/types';
import { useWorkspace } from '../../lib/useWorkspace';
import { EditableText } from '../EditableText';
import { Icon } from '../Icon';
import type { ViewProps } from './types';

export function TableView({ pageId, sectionId, tasks, newTaskAssignee, onOpenTask }: ViewProps) {
  const { members, actions } = useWorkspace();
  const rows = byPosition(tasks);

  return (
    <div className="table-wrap">
      <table className="task-table">
        <thead>
          <tr>
            <th className="col-check" aria-label="Hotovo" />
            <th>Úkol</th>
            <th>Stav</th>
            <th>Priorita</th>
            <th>Přiřazeno</th>
            <th>Začátek</th>
            <th>Termín</th>
            <th className="col-open" aria-label="Detail" />
          </tr>
        </thead>
        <tbody>
          {rows.map((task) => (
            <tr key={task.id} className={task.done ? 'is-done' : ''}>
              <td className="col-check">
                <input
                  type="checkbox"
                  className="task-check"
                  aria-label="Hotovo"
                  checked={task.done}
                  onChange={(e) => actions.update('tasks', task.id, { done: e.target.checked })}
                />
              </td>
              <td className="col-text">
                <EditableText
                  className="cell-text"
                  placeholder="Nový úkol"
                  aria-label="Text úkolu"
                  data-task-input={task.id}
                  table="tasks"
                  rowId={task.id}
                  value={task.text}
                  onValueChange={(text) => actions.update('tasks', task.id, { text }, true)}
                />
              </td>
              <td>
                <select
                  className={`cell-select status-${taskStatus(task)}`}
                  aria-label="Stav"
                  value={taskStatus(task)}
                  onChange={(e) => actions.setTaskStatus(task.id, e.target.value as TaskStatus)}
                >
                  {TASK_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </td>
              <td>
                <select
                  className="cell-select"
                  aria-label="Priorita"
                  value={task.priority ?? ''}
                  onChange={(e) => actions.update('tasks', task.id, { priority: (e.target.value || null) as Priority | null })}
                >
                  <option value="">–</option>
                  <option value="P1">P1</option>
                  <option value="P2">P2</option>
                  <option value="P3">P3</option>
                </select>
              </td>
              <td>
                <select
                  className="cell-select"
                  aria-label="Přiřazeno"
                  value={task.assignee ?? ''}
                  onChange={(e) => actions.update('tasks', task.id, { assignee: e.target.value || null })}
                >
                  <option value="">–</option>
                  {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
                </select>
              </td>
              <td>
                <input
                  type="date"
                  className="cell-date"
                  aria-label="Začátek"
                  value={task.start ?? ''}
                  onChange={(e) => actions.update('tasks', task.id, { start: e.target.value || null })}
                />
              </td>
              <td>
                <input
                  type="date"
                  className="cell-date"
                  aria-label="Termín"
                  value={task.due ?? ''}
                  onChange={(e) => actions.update('tasks', task.id, { due: e.target.value || null })}
                />
              </td>
              <td className="col-open">
                <button type="button" className="icon-btn" aria-label="Otevřít detail" onClick={() => onOpenTask(task.id)}>
                  <Icon name="open" size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="add-task"
        onClick={() => focusTask(actions.createTask(pageId, sectionId, rows.at(-1)?.id, newTaskAssignee))}
      >
        + Nový řádek
      </button>
    </div>
  );
}
