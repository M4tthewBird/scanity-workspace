import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { byPosition } from '../lib/order';
import { groupOf, NO_GROUP, SCANITY, useProjectGroups } from '../lib/projectGroups';
import { pageHref } from '../lib/useRoute';
import type { Page } from '../lib/types';
import { dropIndex, usePointerDrag } from '../lib/usePointerDrag';
import type { PointerDrag } from '../lib/usePointerDrag';
import { useWorkspace } from '../lib/useWorkspace';
import { EditableText } from './EditableText';
import { Icon } from './Icon';
import { AddButton, ProjectTile } from './ProjectTile';

const STEP = 1024;

interface Target {
  group: string;
  overId: string | null;
  before: boolean;
}

// Prohodí dva sousedy. Když mají stejnou pozici, přečísluje se celá skupina.
function useSwap() {
  const { actions } = useWorkspace();
  return (list: Page[], index: number, direction: -1 | 1) => {
    const other = list[index + direction];
    const current = list[index];
    if (!other || !current) return;
    if (other.position === current.position) {
      const next = [...list];
      next.splice(index, 1);
      next.splice(index + direction, 0, current);
      next.forEach((p, i) => actions.update('pages', p.id, { position: (i + 1) * STEP }));
      return;
    }
    actions.update('pages', current.id, { position: other.position });
    actions.update('pages', other.id, { position: current.position });
  };
}

function resolveTarget(x: number, y: number, id: string): Target | null {
  const el = document.elementFromPoint(x, y);
  const groupEl = el?.closest<HTMLElement>('[data-group]');
  if (!groupEl?.dataset.group) return null;
  const hit = dropIndex(el, '[data-tile]', x, y, true);
  const overId = hit?.item.dataset.tile ?? null;
  if (overId === id) return { group: groupEl.dataset.group, overId: null, before: false };
  return { group: groupEl.dataset.group, overId, before: hit?.before ?? false };
}

function Tiles({ items, drag, onDragStart }: {
  items: Page[];
  drag: PointerDrag<Target> | null;
  onDragStart: (event: ReactPointerEvent, page: Page) => void;
}) {
  const swap = useSwap();
  return (
    <>
      {items.map((page, index) => (
        <ProjectTile
          key={page.id}
          page={page}
          canMoveBack={index > 0}
          canMoveForward={index < items.length - 1}
          onMove={(direction) => swap(items, index, direction)}
          dragging={drag?.id === page.id && !drag.copy}
          dropHint={drag?.target?.overId === page.id && drag.id !== page.id ? (drag.target.before ? 'before' : 'after') : null}
          onDragStart={onDragStart}
        />
      ))}
    </>
  );
}

export function ProjectBoard() {
  const { pages, actions } = useWorkspace();
  const swap = useSwap();
  const { industries, options, pinnedIn, normalize, move, duplicate } = useProjectGroups();
  const [showArchive, setShowArchive] = useState(false);
  const archived = pages
    .filter((p) => (p.kind === 'job' || p.kind === 'product') && p.state === 'done')
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
  const { drag, startDrag, onClickCapture } = usePointerDrag<Target>(resolveTarget, (id, target, copy) =>
    copy ? duplicate(id, target.group, target.overId, target.before) : move(id, target.group, target.overId, target.before),
  );
  const onDragStart = (event: ReactPointerEvent, page: Page) => startDrag(event, page.id, page.title || 'Bez názvu');

  const products = byPosition(pages.filter((p) => p.kind === 'product'));
  const freeJobs = pages
    .filter((p) => p.kind === 'job' && !p.pinned && p.state !== 'done' && p.stage !== 'vyfakturovano')
    .sort((a, b) => a.title.localeCompare(b.title, 'cs'));
  const loose = pinnedIn(NO_GROUP);
  // Obor je vidět, když má připnutý projekt, byl založen přímo tady, nebo se nad něj zrovna táhne.
  const groups = industries.filter((i) => i.pinned || pinnedIn(i.id).length > 0);

  const groupClass = (group: string) =>
    `project-group ${drag?.target?.group === group ? 'is-drop-target' : ''}`;

  const pinJob = (id: string, industryId: string | null) => {
    actions.setJobIndustry(id, industryId);
    actions.update('pages', id, { pinned: true });
  };
  const createJob = (title: string, industryId: string | null) => {
    const id = actions.createJob({ title, industryId });
    actions.update('pages', id, { pinned: true });
  };

  return (
    <div className={`project-board ${drag ? 'is-dragging-tile' : ''}`} onClickCapture={onClickCapture}>
      <section className={groupClass(SCANITY)} data-group={SCANITY}>
        <header className="group-head">
          <h2 className="group-name is-fixed">Scanity</h2>
          <AddButton
            label="Přidat produkt"
            candidates={products.filter((p) => !p.pinned && p.state !== 'done')}
            onPick={(id) => actions.update('pages', id, { pinned: true })}
            onCreate={(title) => actions.createPage('product', { title, icon: '📦', pinned: true })}
          />
        </header>
        <div className="project-grid">
          <Tiles items={pinnedIn(SCANITY)} drag={drag} onDragStart={onDragStart} />
          {pinnedIn(SCANITY).length === 0 && <p className="empty-note drop-note">Žádný produkt. Přidejte ho plusem u názvu.</p>}
        </div>
      </section>

      {groups.map((industry, index) => {
        const items = pinnedIn(industry.id);
        return (
          <section className={groupClass(industry.id)} data-group={industry.id} key={industry.id}>
            <header className="group-head">
              <EditableText
                className="group-name"
                placeholder="Název oboru"
                aria-label="Název oboru"
                table="pages"
                rowId={industry.id}
                value={industry.title}
                onValueChange={(title) => actions.update('pages', industry.id, { title }, true)}
              />
              <AddButton
                label="Přidat projekt"
                candidates={freeJobs}
                onPick={(id) => pinJob(id, industry.id)}
                onCreate={(title) => createJob(title, industry.id)}
              />
              <div className="group-actions">
                <button type="button" className="icon-btn group-up" aria-label="Posunout obor výš" disabled={index === 0} onClick={() => swap(groups, index, -1)}>
                  <Icon name="back" size={15} />
                </button>
                <button type="button" className="icon-btn group-down" aria-label="Posunout obor níž" disabled={index === groups.length - 1} onClick={() => swap(groups, index, 1)}>
                  <Icon name="back" size={15} />
                </button>
                {items.length === 0 && (
                  <button type="button" className="icon-btn" aria-label="Skrýt prázdný obor" title="Skrýt prázdný obor" onClick={() => actions.update('pages', industry.id, { pinned: false })}>
                    <Icon name="close" size={15} />
                  </button>
                )}
              </div>
            </header>
            <div className="project-grid">
              <Tiles items={items} drag={drag} onDragStart={onDragStart} />
              {items.length === 0 && <p className="empty-note drop-note">Prázdný obor. Přidejte projekt plusem u názvu nebo sem některý přetáhněte.</p>}
            </div>
          </section>
        );
      })}

      {(loose.length > 0 || drag) && (
        <section className={groupClass(NO_GROUP)} data-group={NO_GROUP}>
          <header className="group-head">
            <h2 className="group-name">Bez oboru</h2>
          </header>
          <div className="project-grid">
            <Tiles items={loose} drag={drag} onDragStart={onDragStart} />
            {loose.length === 0 && <p className="empty-note drop-note">Sem pusťte projekt bez oboru</p>}
          </div>
        </section>
      )}

      <div className="board-foot">
        <button
          type="button"
          className="btn-quiet"
          onClick={() => actions.createPage('industry', { title: '', icon: '🗂️', pinned: true })}
        >
          <Icon name="plus" size={16} /> Nový obor
        </button>
        {archived.length > 0 && (
          <button type="button" className="btn-quiet" aria-expanded={showArchive} onClick={() => setShowArchive(!showArchive)}>
            <Icon name="archive" size={16} /> Archiv <span className="count">{archived.length}</span>
          </button>
        )}
      </div>

      {showArchive && archived.length > 0 && (
        <section className="archive" aria-label="Archiv hotových projektů">
          {archived.map((page) => (
            <div className="archive-row" key={page.id}>
              <span aria-hidden="true">{page.icon || '📄'}</span>
              <a href={pageHref(page.id)}>{page.title || 'Bez názvu'}</a>
              <span className="archive-group">{options.find((o) => o.id === normalize(groupOf(page)))?.label}</span>
              {page.status && <span className="archive-status">{page.status}</span>}
              <button type="button" className="btn-quiet" onClick={() => move(page.id, normalize(groupOf(page)))}>
                Obnovit
              </button>
            </div>
          ))}
        </section>
      )}

      {drag && (
        <div className="drag-ghost tile-ghost" style={{ left: drag.x, top: drag.y }}>
          {drag.copy && <span className="ghost-copy">+ kopie</span>}
          {drag.label}
        </div>
      )}
    </div>
  );
}
