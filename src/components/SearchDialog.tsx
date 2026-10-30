import { useEffect, useMemo, useState } from 'react';
import { pageHref } from '../lib/useRoute';
import { matches } from '../lib/text';
import { liveTasks, useWorkspace } from '../lib/useWorkspace';
import { Icon } from './Icon';

interface Result {
  key: string;
  group: string;
  title: string;
  detail?: string;
  href: string;
  taskId?: string;
}

const PAGE_GROUPS = { product: 'Vývoj', industry: 'Odvětví', job: 'Zakázky', template: 'Zakázky' } as const;
const MAX_RESULTS = 30;

export function SearchDialog({ onClose, onOpenTask }: { onClose: () => void; onOpenTask: (id: string) => void }) {
  const workspace = useWorkspace();
  const { pages, ideas, companies, contacts, milestones } = workspace;
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  const results = useMemo<Result[]>(() => {
    if (!query.trim()) return [];
    const pageTitle = (id: string) => pages.find((p) => p.id === id)?.title;
    const found: Result[] = [
      ...pages
        .filter((p) => matches(query, p.title, p.description))
        .map((p) => ({ key: p.id, group: PAGE_GROUPS[p.kind], title: p.title || 'Bez názvu', href: pageHref(p.id) })),
      ...liveTasks(workspace)
        .filter((t) => matches(query, t.text, t.notes, ...(t.tags ?? [])))
        .map((t) => ({ key: t.id, group: 'Úkoly', title: t.text || 'Nový úkol', detail: pageTitle(t.page_id), href: pageHref(t.page_id), taskId: t.id })),
      ...ideas
        .filter((i) => matches(query, i.text, i.notes, ...(i.tags ?? [])))
        .map((i) => ({ key: i.id, group: 'Nápady', title: i.text, href: '#/dev/ideas' })),
      ...milestones
        .filter((m) => matches(query, m.title, m.notes))
        .map((m) => ({ key: m.id, group: 'Roadmapa', title: m.title || 'Bez názvu', href: '#/dev/roadmap' })),
      ...companies
        .filter((c) => matches(query, c.name, c.notes, c.website))
        .map((c) => ({ key: c.id, group: 'Firmy', title: c.name || 'Bez názvu', href: `#/crm/company/${c.id}` })),
      ...contacts
        .filter((c) => matches(query, c.name, c.email, c.phone, c.notes))
        .map((c) => ({ key: c.id, group: 'Kontakty', title: c.name || 'Bez jména', detail: c.email ?? undefined, href: `#/crm/contact/${c.id}` })),
    ];
    return found.slice(0, MAX_RESULTS);
    // workspace se mění s každou změnou dat, závislosti níž to pokrývají.
  }, [query, pages, workspace.tasks, ideas, milestones, companies, contacts]);

  useEffect(() => setSelected(0), [query]);

  const open = (result: Result) => {
    location.hash = result.href;
    if (result.taskId) onOpenTask(result.taskId);
    onClose();
  };

  return (
    <>
      <div className="sheet-backdrop is-visible" onClick={onClose} />
      <div className="search-dialog" role="dialog" aria-label="Hledání">
        <div className="search-input">
          <Icon name="search" />
          <input
            autoFocus
            placeholder="Hledat úkoly, zakázky, nápady, firmy…"
            aria-label="Hledat"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelected(Math.min(selected + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelected(Math.max(selected - 1, 0));
              } else if (e.key === 'Enter' && results[selected]) {
                open(results[selected]);
              }
            }}
          />
        </div>
        <div className="search-results">
          {query.trim() && results.length === 0 && <p className="empty-note">Nic jsme nenašli. Zkuste jiné slovo.</p>}
          {results.map((result, index) => (
            <button
              type="button"
              key={result.key}
              className={`search-result ${index === selected ? 'is-selected' : ''}`}
              onMouseEnter={() => setSelected(index)}
              onClick={() => open(result)}
            >
              <span className="search-title">{result.title}</span>
              {result.detail && <span className="search-detail">{result.detail}</span>}
              <span className="search-group">{result.group}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
