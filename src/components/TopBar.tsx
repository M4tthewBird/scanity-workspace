import { useEffect, useRef, useState } from 'react';
import { initial } from '../lib/format';
import { useTheme } from '../lib/theme';
import type { Route } from '../lib/useRoute';
import type { SaveStatus } from '../lib/useWorkspace';
import { useWorkspace } from '../lib/useWorkspace';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { Logo } from './Logo';

const STATUS_LABELS: Record<SaveStatus, string> = {
  saved: 'Uloženo',
  saving: 'Ukládám…',
  offline: 'Offline',
  error: 'Chyba',
};

function SaveIndicator() {
  const { status } = useWorkspace();
  return (
    <span className={`save-status status-${status}`} role="status">
      {STATUS_LABELS[status]}
    </span>
  );
}

type TabId = 'overview' | 'dev' | 'industries' | 'jobs' | 'crm' | 'stats';

const TABS: { id: TabId; label: string; href: string; icon: IconName }[] = [
  { id: 'overview', label: 'Přehled', href: '#/', icon: 'home' },
  { id: 'dev', label: 'Vývoj', href: '#/dev', icon: 'layers' },
  { id: 'industries', label: 'Odvětví', href: '#/industries', icon: 'grid' },
  { id: 'jobs', label: 'Zakázky', href: '#/jobs', icon: 'briefcase' },
  { id: 'crm', label: 'CRM', href: '#/crm', icon: 'users' },
  { id: 'stats', label: 'Statistiky', href: '#/stats', icon: 'chart' },
];

function activeTab(route: Route, pageKind: string | undefined): TabId {
  switch (route.name) {
    case 'overview':
      return 'overview';
    case 'industries':
      return 'industries';
    case 'jobs':
      return 'jobs';
    case 'crm':
    case 'company':
    case 'contact':
      return 'crm';
    case 'stats':
      return 'stats';
    case 'page':
      if (pageKind === 'industry') return 'industries';
      if (pageKind === 'job' || pageKind === 'template') return 'jobs';
      return 'dev';
    default:
      return 'dev';
  }
}

interface Props {
  route: Route;
  onAdd: () => void;
  onSearch: () => void;
  onSignOut: () => void;
}

export function TopBar({ route, onAdd, onSearch, onSignOut }: Props) {
  const { pages, me } = useWorkspace();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pageKind = route.name === 'page' ? pages.find((p) => p.id === route.id)?.kind : undefined;
  const active = activeTab(route, pageKind);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  useEffect(() => setMoreOpen(false), [active, route]);

  const tab = (id: TabId) => TABS.find((t) => t.id === id)!;
  const bottomLink = (id: TabId) => (
    <a className={`bottom-link ${active === id ? 'is-active' : ''}`} href={tab(id).href} aria-current={active === id ? 'page' : undefined}>
      <Icon name={tab(id).icon} size={22} />
      <span>{tab(id).label}</span>
    </a>
  );

  return (
    <>
      <header className="topbar">
        <a className="topbar-logo" href="#/" aria-label="Scanity, přehled"><Logo /></a>
        <nav className="tabs" aria-label="Hlavní karty">
          {TABS.map((t) => (
            <a key={t.id} className={`tab ${active === t.id ? 'is-active' : ''}`} href={t.href} aria-current={active === t.id ? 'page' : undefined}>
              {t.label}
            </a>
          ))}
        </nav>
        <div className="topbar-actions">
          <SaveIndicator />
          <button type="button" className="search-trigger" onClick={onSearch}>
            <Icon name="search" size={16} />
            <span>Hledat</span>
            <kbd>Ctrl K</kbd>
          </button>
          <button type="button" className="icon-btn search-icon" aria-label="Hledat" onClick={onSearch}>
            <Icon name="search" />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={theme === 'dark' ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
            title={theme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}
            onClick={toggle}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <button type="button" className="btn-primary add-button" onClick={onAdd}>
            <Icon name="plus" size={16} /> Přidat
          </button>
          <div className="user-menu" ref={menuRef}>
            <button
              type="button"
              className="avatar-button"
              aria-label={`Účet: ${me.name}`}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span className="avatar" style={{ background: me.color ?? undefined }}>{initial(me.name)}</span>
            </button>
            {menuOpen && (
              <div className="popover user-popover">
                <p>{me.name}</p>
                <button type="button" className="btn-quiet" onClick={onSignOut}>Odhlásit se</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {moreOpen && (
        <>
          <div className="sheet-backdrop" onClick={() => setMoreOpen(false)} />
          <div className="more-sheet">
            <a className="more-link" href="#/industries"><Icon name="grid" /> Odvětví</a>
            <a className="more-link" href="#/stats"><Icon name="chart" /> Statistiky</a>
            <button type="button" className="more-link" onClick={onSignOut}><Icon name="back" /> Odhlásit se</button>
          </div>
        </>
      )}

      <nav className="bottom-nav" aria-label="Hlavní karty">
        {bottomLink('overview')}
        {bottomLink('dev')}
        <button type="button" className="bottom-add" aria-label="Rychle přidat" onClick={onAdd}>
          <Icon name="plus" size={26} />
        </button>
        {bottomLink('jobs')}
        {bottomLink('crm')}
        <button
          type="button"
          className={`bottom-link ${active === 'industries' || active === 'stats' ? 'is-active' : ''}`}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(!moreOpen)}
        >
          <Icon name="more" size={22} />
          <span>Více</span>
        </button>
      </nav>
    </>
  );
}
