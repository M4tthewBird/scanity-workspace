import { byPosition } from '../lib/order';
import { pageHref } from '../lib/useRoute';
import { liveTasks, useWorkspace } from '../lib/useWorkspace';
import { Icon } from './Icon';

type Active = 'dev' | 'ideas' | 'tasks' | 'roadmap' | string;

// Podnavigace karty Vývoj: produkty a společné seznamy.
export function DevNav({ active }: { active: Active }) {
  const { pages, ideas, actions } = useWorkspace();
  const products = byPosition(pages.filter((p) => p.kind === 'product'));
  const newIdeas = ideas.filter((i) => i.status === 'new').length;
  const link = (id: Active, href: string, label: React.ReactNode) => (
    <a className={`subtab ${active === id ? 'is-active' : ''}`} href={href} aria-current={active === id ? 'page' : undefined}>
      {label}
    </a>
  );

  return (
    <nav className="subnav" aria-label="Vývoj">
      {link('dev', '#/dev', 'Produkty')}
      {products.map((product) => (
        <span key={product.id} className="contents">
          {link(product.id, pageHref(product.id), product.title || 'Bez názvu')}
        </span>
      ))}
      <button
        type="button"
        className="subtab subtab-add"
        aria-label="Nový produkt"
        title="Nový produkt"
        onClick={() => (location.hash = pageHref(actions.createPage('product')))}
      >
        <Icon name="plus" size={15} />
      </button>
      <span className="subnav-divider" />
      {link('ideas', '#/dev/ideas', <>Nápady{newIdeas > 0 && <span className="count">{newIdeas}</span>}</>)}
      {link('tasks', '#/dev/tasks', 'Úkoly')}
      {link('roadmap', '#/dev/roadmap', 'Roadmapa')}
    </nav>
  );
}

export function DevHome() {
  const workspace = useWorkspace();
  const { pages, ideas, milestones } = workspace;
  const products = byPosition(pages.filter((p) => p.kind === 'product'));
  const tasks = liveTasks(workspace);

  return (
    <div className="view">
      <DevNav active="dev" />
      <h1 className="view-title">Produkty</h1>
      {products.length === 0 && <p className="empty-note">Zatím tu není žádný produkt. Přidejte ho tlačítkem + v řádku nahoře.</p>}
      <div className="product-list">
        {products.map((product) => {
          const own = tasks.filter((t) => t.page_id === product.id);
          const done = own.filter((t) => t.done).length;
          const progress = own.length ? Math.round((done / own.length) * 100) : 0;
          const productIdeas = ideas.filter((i) => i.product_id === product.id && i.status === 'new').length;
          const productMilestones = milestones.filter((m) => m.product_id === product.id).length;
          return (
            <a className="product-row" href={pageHref(product.id)} key={product.id}>
              <span className="product-icon">{product.icon}</span>
              <span className="product-name">{product.title || 'Bez názvu'}</span>
              <span className="product-meta">
                {productMilestones > 0 && <span>Roadmapa {productMilestones}</span>}
                {productIdeas > 0 && <span>Nápady {productIdeas}</span>}
                <span>{done}/{own.length} hotovo</span>
              </span>
              <span className="progress product-progress" role="img" aria-label={`Hotovo ${progress} %`}>
                <span style={{ width: `${progress}%` }} />
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
