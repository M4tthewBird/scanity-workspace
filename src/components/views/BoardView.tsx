import { between, byPosition } from '../../lib/order';
import { focusTask } from '../../lib/focus';
import { TASK_STATUSES, taskStatus } from '../../lib/types';
import type { Task, TaskStatus } from '../../lib/types';
import { dropIndex, usePointerDrag } from '../../lib/usePointerDrag';
import { useWorkspace } from '../../lib/useWorkspace';
import { EditableText } from '../EditableText';
import { Icon } from '../Icon';
import { TaskChips } from '../TaskChips';
import type { ViewProps } from './types';

interface Target {
  status: TaskStatus;
  overId: string | null;
  before: boolean;
}

// Text karty jde chytit taky, drag začne až po pohybu, takže klik do textu dál edituje.
const INTERACTIVE = 'input, select, button, a, label';

export function BoardView({ pageId, sectionId, tasks, newTaskAssignee, onOpenTask }: ViewProps) {
  const { actions } = useWorkspace();
  const scope = sectionId ?? 'none';
  const column = (status: TaskStatus, exceptId?: string) =>
    byPosition(tasks.filter((t) => taskStatus(t) === status && t.id !== exceptId));

  const { drag, startDrag, onClickCapture } = usePointerDrag<Target>(
    (x, y, id) => {
      const el = document.elementFromPoint(x, y);
      const col = el?.closest<HTMLElement>(`[data-board="${scope}"] [data-board-col]`);
      if (!col) return null;
      const hit = dropIndex(el, '[data-card]', x, y, false);
      const overId = hit?.item.dataset.card ?? null;
      return { status: col.dataset.boardCol as TaskStatus, overId: overId === id ? null : overId, before: hit?.before ?? false };
    },
    (id, target) => {
      const items = column(target.status, id);
      const overIndex = target.overId ? items.findIndex((t) => t.id === target.overId) : -1;
      const index = overIndex < 0 ? items.length : target.before ? overIndex : overIndex + 1;
      actions.update('tasks', id, {
        status: target.status,
        done: target.status === 'done',
        position: between(items[index - 1]?.position, items[index]?.position),
      });
    },
  );

  const addCard = (status: TaskStatus) => {
    const last = column(status).at(-1);
    const id = actions.createTask(pageId, sectionId, last?.id, newTaskAssignee, { status, done: status === 'done' });
    focusTask(id);
  };

  return (
    <div className="board" data-board={scope} onClickCapture={onClickCapture}>
      {TASK_STATUSES.map((status) => {
        const cards = column(status.id);
        const over = drag?.target?.status === status.id;
        return (
          <section className={`board-col is-${status.id} ${over ? 'is-over' : ''}`} data-board-col={status.id} key={status.id}>
            <h3>
              {status.label} <span className="count">{cards.length}</span>
            </h3>
            <div className="board-cards">
              {cards.map((task: Task) => {
                const hint = drag?.target?.overId === task.id ? (drag.target.before ? 'drop-before' : 'drop-after') : '';
                return (
                  <article
                    key={task.id}
                    className={`board-card ${drag?.id === task.id ? 'is-drag-source' : ''} ${hint}`}
                    data-card={task.id}
                    onPointerDown={(e) => {
                      if (!(e.target as HTMLElement).closest(INTERACTIVE)) startDrag(e, task.id, task.text || 'Nový úkol');
                    }}
                  >
                    <EditableText
                      className="board-text"
                      placeholder="Nový úkol"
                      aria-label="Text úkolu"
                      data-task-input={task.id}
                      table="tasks"
                      rowId={task.id}
                      value={task.text}
                      onValueChange={(text) => actions.update('tasks', task.id, { text }, true)}
                    />
                    <div className="board-card-foot">
                      <TaskChips task={task} />
                      <button type="button" className="icon-btn" aria-label="Otevřít detail" onClick={() => onOpenTask(task.id)}>
                        <Icon name="open" size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <button type="button" className="add-task board-add" onClick={() => addCard(status.id)}>+ Přidat</button>
          </section>
        );
      })}
      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>{drag.label}</div>
      )}
    </div>
  );
}
