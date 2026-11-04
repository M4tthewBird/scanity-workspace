import type { PointerEvent } from 'react';
import { focusTask } from '../lib/focus';
import { SECTION_VIEWS } from '../lib/types';
import type { Section as SectionRow, SectionView, Task } from '../lib/types';
import type { DragState } from '../lib/useTaskDrag';
import { useWorkspace } from '../lib/useWorkspace';
import { EditableText } from './EditableText';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { TaskRow } from './TaskRow';
import { BoardView } from './views/BoardView';
import { TableView } from './views/TableView';
import { TimelineView } from './views/TimelineView';

export const VIEW_ICONS: Record<SectionView, IconName> = { list: 'list', board: 'board', table: 'table', timeline: 'timeline' };

interface Props {
  pageId: string;
  section: SectionRow | null;
  tasks: Task[];
  allTasks: Task[];
  newTaskAssignee: string | null;
  drag: DragState | null;
  viewsEnabled: boolean;
  onDragStart: (event: PointerEvent, task: Task) => void;
  onOpenTask: (id: string) => void;
}

export function ViewSwitch({ value, onChange }: { value: SectionView; onChange: (view: SectionView) => void }) {
  return (
    <div className="view-switch" role="group" aria-label="Pohled">
      {SECTION_VIEWS.map((v) => (
        <button
          type="button"
          key={v.id}
          className={value === v.id ? 'is-active' : ''}
          aria-pressed={value === v.id}
          aria-label={v.label}
          title={v.label}
          onClick={() => onChange(v.id)}
        >
          <Icon name={VIEW_ICONS[v.id]} size={15} />
        </button>
      ))}
    </div>
  );
}

export function Section({ pageId, section, tasks, allTasks, newTaskAssignee, drag, viewsEnabled, onDragStart, onOpenTask }: Props) {
  const { actions } = useWorkspace();
  const sectionId = section?.id ?? null;
  const view: SectionView = section?.view ?? 'list';
  const target = drag?.target?.sectionId === sectionId ? drag.target : null;
  const doneCount = allTasks.filter((t) => t.done).length;
  const viewProps = { pageId, sectionId, tasks, newTaskAssignee, onOpenTask };

  const deleteSection = () => {
    if (!section) return;
    const question = `Smazat sekci „${section.title}“? Její úkoly (počet: ${allTasks.length}) zůstanou na stránce bez sekce.`;
    if (allTasks.length === 0 || window.confirm(question)) actions.deleteSection(section.id);
  };

  const switcher = viewsEnabled && (
    <ViewSwitch value={view} onChange={(next) => actions.setSectionView(pageId, sectionId, next)} />
  );

  return (
    <section
      className={`section view-${view} ${view === 'list' && target && !target.overTaskId ? 'is-drop-target' : ''}`}
      data-section-id={view === 'list' ? (sectionId ?? '') : undefined}
    >
      {section ? (
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
          {switcher}
          <button type="button" className="icon-btn section-delete" aria-label="Smazat sekci" title="Smazat sekci" onClick={deleteSection}>
            <Icon name="close" size={16} />
          </button>
        </header>
      ) : (
        switcher && <header className="section-header is-bare">{switcher}</header>
      )}

      {view === 'board' && <BoardView {...viewProps} />}
      {view === 'table' && <TableView {...viewProps} />}
      {view === 'timeline' && <TimelineView {...viewProps} />}
      {view === 'list' && (
        <>
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
        </>
      )}
    </section>
  );
}
