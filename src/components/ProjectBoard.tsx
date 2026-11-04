import { byPosition } from '../lib/order';
import type { Page } from '../lib/types';
import { useWorkspace } from '../lib/useWorkspace';
import { EditableText } from './EditableText';
import { Icon } from './Icon';
import { AddTile, ProjectTile } from './ProjectTile';

const STEP = 1024;

// Prohodí dva sousedy. Když mají stejnou pozici, přečísluje se celá skupina.
function useMove() {
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

function Tiles({ items }: { items: Page[] }) {
  const move = useMove();
  return (
    <>
      {items.map((page, index) => (
        <ProjectTile
          key={page.id}
          page={page}
          canMoveBack={index > 0}
          canMoveForward={index < items.length - 1}
          onMove={(direction) => move(items, index, direction)}
        />
      ))}
    </>
  );
}

export function ProjectBoard() {
  const { pages, actions } = useWorkspace();
  const move = useMove();
  const jobs = pages.filter((p) => p.kind === 'job');
  const products = byPosition(pages.filter((p) => p.kind === 'product'));
  const industries = byPosition(pages.filter((p) => p.kind === 'industry'));
  const pinnedJobs = byPosition(jobs.filter((j) => j.pinned));
  const freeJobs = jobs
    .filter((j) => !j.pinned && j.stage !== 'vyfakturovano')
    .sort((a, b) => a.title.localeCompare(b.title, 'cs'));

  // Obor je vidět, když má připnutou zakázku nebo byl založen přímo tady.
  const groups = industries.filter((i) => i.pinned || pinnedJobs.some((j) => j.industry_id === i.id));
  const known = new Set(industries.map((i) => i.id));
  const loose = pinnedJobs.filter((j) => !j.industry_id || !known.has(j.industry_id));

  const pinJob = (id: string, industryId: string | null) => {
    actions.setJobIndustry(id, industryId);
    actions.update('pages', id, { pinned: true });
  };
  const createJob = (title: string, industryId: string | null) => {
    const id = actions.createJob({ title, industryId });
    actions.update('pages', id, { pinned: true });
  };

  return (
    <div className="project-board">
      <section className="project-group">
        <header className="group-head">
          <h2 className="group-name">Scanity</h2>
        </header>
        <div className="project-grid">
          <Tiles items={products.filter((p) => p.pinned)} />
          <AddTile
            noun="produkt"
            candidates={products.filter((p) => !p.pinned)}
            onPick={(id) => actions.update('pages', id, { pinned: true })}
            onCreate={(title) => actions.createPage('product', { title, icon: '📦', pinned: true })}
          />
        </div>
      </section>

      {groups.map((industry, index) => {
        const items = pinnedJobs.filter((j) => j.industry_id === industry.id);
        return (
          <section className="project-group" key={industry.id}>
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
              <div className="group-actions">
                <button type="button" className="icon-btn group-up" aria-label="Posunout obor výš" disabled={index === 0} onClick={() => move(groups, index, -1)}>
                  <Icon name="back" size={15} />
                </button>
                <button type="button" className="icon-btn group-down" aria-label="Posunout obor níž" disabled={index === groups.length - 1} onClick={() => move(groups, index, 1)}>
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
              <Tiles items={items} />
              <AddTile
                noun="projekt"
                candidates={freeJobs}
                onPick={(id) => pinJob(id, industry.id)}
                onCreate={(title) => createJob(title, industry.id)}
              />
            </div>
          </section>
        );
      })}

      {loose.length > 0 && (
        <section className="project-group">
          <header className="group-head">
            <h2 className="group-name">Bez oboru</h2>
          </header>
          <div className="project-grid">
            <Tiles items={loose} />
          </div>
        </section>
      )}

      <button
        type="button"
        className="btn-quiet new-group"
        onClick={() => actions.createPage('industry', { title: '', icon: '🗂️', pinned: true })}
      >
        <Icon name="plus" size={16} /> Nový obor
      </button>
    </div>
  );
}
