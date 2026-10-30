import type { PointerEvent } from 'react';
import { focusTask } from '../lib/focus';
import type { Section as SectionRow, Task } from '../lib/types';
import type { DragState } from '../lib/useTaskDrag';
import { useWorkspace } from '../lib/useWorkspace';
import { EditableText } from './EditableText';
import { Icon } from './Icon';
import { TaskRow } from './TaskRow';

interface Props {
  pageId: string;
  section: SectionRow | null;
  tasks: Task[];
  allTasks: Task[];
  newTaskAssignee: string | null;
  drag: DragState | null;
  onDragStart: (event: PointerEvent, task: Task) => void;
  onOpenTask: (id: string) => void;
}

export function Section({ pageId, section, tasks, allTasks, newTaskAssignee, drag, onDragStart, onOpenTask }: Props) {
  const { actions } = useWorkspace();
  const sectionId = section?.id ?? null;
  const target = drag?.target?.sectionId === sectionId ? drag.target : null;
  const doneCount = allTasks.filter((t) => t.done).length;

  const deleteSection = () => {
    if (!section) return;
    const question = `Smazat sekci „${section.title}“? Její úkoly (počet: ${allTasks.length}) zůstanou na stránce bez sekce.`;
    if (allTasks.length === 0 || window.confirm(question)) actions.deleteSection(section.id);
  };

  return (
    <section className={`section ${target && !target.overTaskId ? 'is-drop-target' : ''}`} data-section-id={sectionId ?? ''}>
      {section && (
        <header className="section-header">
          <EditableText
            className="section-title"
            placeholder="Název sekce"
            aria-label="Název sekce"
            data-section-title={section.id}
            table="sections"
            rowId={section.id}
            value={section.title}
            onValueChange={(title) => actions.update('sections', section.id, { title }, true)}
          />
          <span className="section-count">{doneCount}/{allTasks.length}</span>
          <button type="button" className="icon-btn section-delete" aria-label="Smazat sekci" title="Smazat sekci" onClick={deleteSection}>
            <Icon name="close" size={16} />
          </button>
        </header>
      )}
      <div className="task-list">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            newTaskAssignee={newTaskAssignee}
            dragging={drag?.taskId === task.id}
            dropHint={target?.overTaskId === task.id ? (target.before ? 'before' : 'after') : null}
            onDragStart={onDragStart}
            onOpen={onOpenTask}
          />
        ))}
      </div>
      <button
        type="button"
        className="add-task"
        onClick={() => focusTask(actions.createTask(pageId, sectionId, undefined, newTaskAssignee))}
      >
        + Přidat úkol
      </button>
    </section>
  );
}
