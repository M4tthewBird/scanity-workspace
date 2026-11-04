import { useEffect, useState } from 'react';
import type { PointerEvent } from 'react';
import { focusElement } from '../lib/focus';
import { byPosition } from '../lib/order';
import type { PageKind, Task } from '../lib/types';
import { useTaskDrag } from '../lib/useTaskDrag';
import { useWorkspace } from '../lib/useWorkspace';
import { EditableText } from './EditableText';
import { EmojiPicker } from './EmojiPicker';
import { Icon } from './Icon';
import { IndustryPanel } from './Industries';
import { JobHistory, JobPanel } from './Jobs';
import { ProjectMeetingNotes } from './Meetings';
import { ProjectPanel } from './ProjectPanel';
import { Section, VIEW_ICONS } from './Section';
import { SECTION_VIEWS } from '../lib/types';
import { DevNav } from './Vyvoj';

type Filter = 'all' | 'open' | 'mine';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Vše' },
  { id: 'open', label: 'Otevřené' },
  { id: 'mine', label: 'Moje' },
];

const PARENTS: Record<PageKind, { href: string; label: string }> = {
  product: { href: '#/dev', label: 'Vývoj' },
  industry: { href: '#/industries', label: 'Odvětví' },
  job: { href: '#/jobs', label: 'Zakázky' },
  template: { href: '#/jobs', label: 'Zakázky' },
};

export function PageView({ pageId, onOpenTask }: { pageId: string; onOpenTask: (id: string) => void }) {
  const { pages, sections, tasks, me, actions } = useWorkspace();
  const [filter, setFilter] = useState<Filter>('all');
  const { drag, startDrag } = useTaskDrag((taskId, target) =>
    actions.moveTask(taskId, target.sectionId, target.overTaskId, target.before),
  );

  const page = pages.find((p) => p.id === pageId);
  // Sloupce z migrací 004 a 005: bez nich se nové ovládání neukáže, aby zápis neselhal.
  const projectsEnabled = pages.some((p) => p.pinned !== undefined);
  const viewsEnabled = sections.some((s) => s.view !== undefined);

  // Nová stránka má prázdný název, rovnou do něj přesuneme kurzor.
  const isUntitled = page?.title === '';
  useEffect(() => {
    if (isUntitled) focusElement('[data-page-title]');
  }, []);

  if (!page) {
    return (
      <div className="empty">
        <p>Tato stránka neexistuje nebo byla smazána.</p>
        <a href="#/">Zpět na přehled</a>
      </div>
    );
  }

  const parent = PARENTS[page.kind];
  const pageSections = byPosition(sections.filter((s) => s.page_id === pageId));
  const pageTasks = byPosition(tasks.filter((t) => t.page_id === pageId));
  const doneCount = pageTasks.filter((t) => t.done).length;
  const progress = pageTasks.length ? Math.round((doneCount / pageTasks.length) * 100) : 0;

  const matchesFilter = (task: Task) =>
    filter === 'all' || (filter === 'open' && !task.done) || (filter === 'mine' && task.assignee === me.user_id);
  const newTaskAssignee = filter === 'mine' ? me.user_id : null;

  const deletePage = () => {
    const question = `Smazat „${page.title || 'Bez názvu'}“? Spolu s tím se smažou všechny úkoly (počet: ${pageTasks.length}). Tuto akci nelze vrátit.`;
    if (window.confirm(question)) {
      actions.deletePage(page.id);
      location.hash = parent.href;
    }
  };

  const onDragStart = (event: PointerEvent, task: Task) => startDrag(event, task.id, task.text);
  const unsectioned = pageTasks.filter((t) => t.section_id === null);

  const renderSection = (section: (typeof pageSections)[number] | null, all: Task[]) => (
    <Section
      key={section?.id ?? 'none'}
      pageId={page.id}
      section={section}
      allTasks={all}
      tasks={all.filter(matchesFilter)}
      newTaskAssignee={newTaskAssignee}
      drag={drag}
      viewsEnabled={viewsEnabled}
      onDragStart={onDragStart}
      onOpenTask={onOpenTask}
    />
  );

  return (
    <article className="view">
      {page.kind === 'product' ? (
        <DevNav active={page.id} />
      ) : (
        <a className="back-link" href={parent.href}><Icon name="back" size={16} /> {parent.label}</a>
      )}

      <header className="page-header">
        <EmojiPicker value={page.icon || '📄'} onChange={(icon) => actions.update('pages', page.id, { icon })} />
        <div className="page-heading">
          <EditableText
            className="page-title"
            placeholder="Bez názvu"
            aria-label="Název"
            data-page-title=""
            table="pages"
            rowId={page.id}
            value={page.title}
            onValueChange={(title) => actions.update('pages', page.id, { title }, true)}
          />
          <EditableText
            className="page-description"
            placeholder="Přidat popis…"
            aria-label="Popis"
            multiline
            table="pages"
            rowId={page.id}
            value={page.description ?? ''}
            onValueChange={(description) => actions.update('pages', page.id, { description }, true)}
          />
        </div>
        <button type="button" className="icon-btn page-delete" aria-label="Smazat" title="Smazat" onClick={deletePage}>
          <Icon name="trash" />
        </button>
      </header>

      {page.kind === 'template' && <p className="form-hint">Každá nová zakázka dostane kopii těchto úkolů.</p>}
      {projectsEnabled && (page.kind === 'job' || page.kind === 'product') && <ProjectPanel page={page} />}
      {page.kind === 'job' && <JobPanel job={page} />}
      {page.kind === 'industry' && <IndustryPanel industry={page} />}

      <div className="progress-row">
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Hotové úkoly"
        >
          <div style={{ width: `${progress}%` }} />
        </div>
        <span className="progress-label">{doneCount} / {pageTasks.length} hotovo</span>
      </div>

      <div className="segmented filters" role="group" aria-label="Filtr úkolů">
        {FILTERS.map((f) => (
          <button
            type="button"
            key={f.id}
            className={filter === f.id ? 'is-active' : ''}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {(unsectioned.length > 0 || pageSections.length === 0) && renderSection(null, unsectioned)}
      {pageSections.map((section) => renderSection(section, pageTasks.filter((t) => t.section_id === section.id)))}

      <div className="add-block">
        <span className="add-block-label">+ Přidat blok</span>
        {(viewsEnabled ? SECTION_VIEWS : SECTION_VIEWS.slice(0, 1)).map((v) => (
          <button
            type="button"
            key={v.id}
            className="btn-quiet"
            onClick={() => {
              const title = v.id === 'list' ? 'Nová sekce' : v.label;
              const id = actions.createSection(page.id, viewsEnabled ? { title, view: v.id } : {});
              focusElement(`[data-section-title="${id}"]`, true);
            }}
          >
            <Icon name={VIEW_ICONS[v.id]} size={15} /> {v.label}
          </button>
        ))}
      </div>

      {(page.kind === 'job' || page.kind === 'product') && <ProjectMeetingNotes page={page} />}
      {page.kind === 'job' && <JobHistory job={page} />}

      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          {drag.text || 'Nový úkol'}
        </div>
      )}
    </article>
  );
}
