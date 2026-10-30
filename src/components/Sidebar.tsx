import { byPosition } from '../lib/order';
import { initial } from '../lib/format';
import { pageHref } from '../lib/useRoute';
import type { Route } from '../lib/useRoute';
import type { SaveStatus } from '../lib/useWorkspace';
import { useWorkspace } from '../lib/useWorkspace';
import { Logo } from './Logo';

const STATUS_LABELS: Record<SaveStatus, string> = {
  saved: 'Uloženo',
  saving: 'Ukládám…',
  offline: 'Offline',
  error: 'Chyba',
};

export function SaveIndicator() {
  const { status } = useWorkspace();
  return (
    <span className={`save-status status-${status}`} role="status">
      {STATUS_LABELS[status]}
    </span>
  );
}

interface Props {
  route: Route;
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

export function Sidebar({ route, open, onClose, onSignOut }: Props) {
  const { pages, me, actions } = useWorkspace();

  const linkClass = (active: boolean) => `nav-link ${active ? 'is-active' : ''}`;

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar-head">
          <Logo />
          <SaveIndicator />
        </div>
        <nav className="sidebar-nav" aria-label="Hlavní navigace">
          <a className={linkClass(route.name === 'overview')} href="#/">Přehled</a>
          <a className={linkClass(route.name === 'my')} href="#/my">Moje úkoly</a>
          <div className="nav-heading">Stránky</div>
          {byPosition(pages).map((page) => (
            <a
              key={page.id}
              className={linkClass(route.name === 'page' && route.id === page.id)}
              href={pageHref(page.id)}
            >
              <span className="nav-icon">{page.icon}</span>
              <span className="nav-title">{page.title || 'Bez názvu'}</span>
            </a>
          ))}
          <button type="button" className="nav-link nav-add" onClick={() => (location.hash = pageHref(actions.createPage()))}>
            + Nová stránka
          </button>
        </nav>
        <div className="sidebar-user">
          <span className="avatar" style={{ background: me.color ?? undefined }}>{initial(me.name)}</span>
          <span className="sidebar-user-name">{me.name}</span>
          <button type="button" className="btn-link" onClick={onSignOut}>Odhlásit</button>
        </div>
      </aside>
    </>
  );
}
