import { formatDue, initial, isOverdue } from '../lib/format';
import type { Priority, Task } from '../lib/types';
import { useWorkspace } from '../lib/useWorkspace';

const NEXT_PRIORITY: Record<string, Priority | null> = { none: 'P1', P1: 'P2', P2: 'P3', P3: null };

export function TaskChips({ task }: { task: Task }) {
  const { members, actions } = useWorkspace();
  const assignee = members.find((m) => m.user_id === task.assignee);
  const overdue = isOverdue(task.due, task.done);

  return (
    <div className="chips">
      <button
        type="button"
        className={`chip ${task.priority ? `prio-${task.priority}` : 'chip-empty'}`}
        title="Priorita (klik mění)"
        aria-label={task.priority ? `Priorita ${task.priority}, změnit` : 'Nastavit prioritu'}
        onClick={() => actions.update('tasks', task.id, { priority: NEXT_PRIORITY[task.priority ?? 'none'] })}
      >
        {task.priority ?? 'P'}
      </button>

      <label className={`assignee ${assignee ? '' : 'chip-empty'}`} title={assignee ? assignee.name : 'Přiřadit'}>
        <span className="avatar" style={assignee ? { background: assignee.color ?? undefined } : undefined}>
          {assignee ? initial(assignee.name) : '+'}
        </span>
        <select
          aria-label="Přiřazený člověk"
          value={task.assignee ?? ''}
          onChange={(e) => actions.update('tasks', task.id, { assignee: e.target.value || null })}
        >
          <option value="">Nepřiřazeno</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>{m.name}</option>
          ))}
        </select>
      </label>

      <label className={`chip due ${task.due ? '' : 'chip-empty'} ${overdue ? 'overdue' : ''}`} title="Termín">
        {task.due ? formatDue(task.due) : '📅'}
        <input
          type="date"
          aria-label="Termín"
          value={task.due ?? ''}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker();
            } catch {
              // Prohlížeč bez showPicker otevře výběr po svém.
            }
          }}
          onChange={(e) => actions.update('tasks', task.id, { due: e.target.value || null })}
        />
      </label>
    </div>
  );
}
