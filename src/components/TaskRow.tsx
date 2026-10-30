import type { KeyboardEvent, PointerEvent } from 'react';
import { adjacentTaskId, focusTask } from '../lib/focus';
import type { Task } from '../lib/types';
import { useWorkspace } from '../lib/useWorkspace';
import { EditableText } from './EditableText';
import { TaskChips } from './TaskChips';

interface Props {
  task: Task;
  newTaskAssignee: string | null;
  dropHint: 'before' | 'after' | null;
  dragging: boolean;
  onDragStart: (event: PointerEvent, task: Task) => void;
  onOpen: (id: string) => void;
}

export function TaskRow({ task, newTaskAssignee, dropHint, dragging, onDragStart, onOpen }: Props) {
  const { actions } = useWorkspace();

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter') {
      focusTask(actions.createTask(task.page_id, task.section_id, task.id, newTaskAssignee));
    } else if (event.key === 'Backspace' && event.currentTarget.value === '') {
      event.preventDefault();
      const target = adjacentTaskId(task.id, -1) ?? adjacentTaskId(task.id, 1);
      actions.deleteTask(task.id);
      if (target) focusTask(target);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const target = adjacentTaskId(task.id, event.key === 'ArrowUp' ? -1 : 1);
      if (target) {
        event.preventDefault();
        focusTask(target);
      }
    }
  };

  const classes = ['task-row', task.done && 'is-done', dragging && 'is-drag-source', dropHint && `drop-${dropHint}`];

  return (
    <div className={classes.filter(Boolean).join(' ')} data-task-row={task.id}>
      <button
        type="button"
        className="drag-handle"
        aria-label="Přesunout úkol"
        title="Přetáhnout"
        tabIndex={-1}
        onPointerDown={(event) => onDragStart(event, task)}
      >
        ⋮⋮
      </button>
      <input
        type="checkbox"
        className="task-check"
        aria-label={task.done ? 'Označit jako nehotové' : 'Označit jako hotové'}
        checked={task.done}
        onChange={(e) => actions.update('tasks', task.id, { done: e.target.checked })}
      />
      <EditableText
        className="task-text"
        placeholder="Nový úkol"
        aria-label="Text úkolu"
        data-task-input={task.id}
        table="tasks"
        rowId={task.id}
        value={task.text}
        onValueChange={(text) => actions.update('tasks', task.id, { text }, true)}
        onKeyDown={onKeyDown}
      />
      <TaskChips task={task} />
      <button type="button" className="icon-btn open-task" aria-label="Otevřít detail" title="Otevřít detail" onClick={() => onOpen(task.id)}>
        ↗
      </button>
    </div>
  );
}
