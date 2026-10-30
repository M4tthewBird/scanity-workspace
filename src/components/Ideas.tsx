import { useState } from 'react';
import { downloadCsv } from '../lib/csv';
import { formatDateTime } from '../lib/format';
import { byPosition } from '../lib/order';
import { pageHref } from '../lib/useRoute';
import { IDEA_STATUSES } from '../lib/types';
import type { Idea, IdeaStatus } from '../lib/types';
import { useWorkspace } from '../lib/useWorkspace';
import { Comments } from './Comments';
import { EditableText } from './EditableText';
import { ExportButton, TagInput } from './Fields';
import { DevDrawerHint } from './Roadmap';
import { DevNav } from './Vyvoj';

function IdeaRow({ idea }: { idea: Idea }) {
  const { pages, members, actions } = useWorkspace();
  const [open, setOpen] = useState(false);
  const products = byPosition(pages.filter((p) => p.kind === 'product'));
  const product = products.find((p) => p.id === idea.product_id);
  const author = members.find((m) => m.user_id === idea.created_by);

  return (
    <div className={`idea ${open ? 'is-open' : ''} ${idea.status === 'rejected' ? 'is-rejected' : ''}`}>
      <div className="idea-head">
        <EditableText
          className="idea-text"
          aria-label="Text nápadu"
          placeholder="Nápad"
          table="ideas"
          rowId={idea.id}
          value={idea.text}
          onValueChange={(text) => actions.update('ideas', idea.id, { text }, true)}
        />
        <select
          className="pill-select"
          aria-label="Stav nápadu"
          value={idea.status}
          onChange={(e) => actions.update('ideas', idea.id, { status: e.target.value as IdeaStatus })}
        >
          {IDEA_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <button type="button" className="btn-quiet" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Zavřít' : 'Detail'}
        </button>
      </div>
      <div className="idea-meta">
        {product && <span>{product.title}</span>}
        {author && <span>{author.name}</span>}
        {idea.created_at && <span>{formatDateTime(idea.created_at)}</span>}
        {(idea.tags ?? []).map((tag) => <span className="tag" key={tag}>{tag}</span>)}
      </div>
      {open && (
        <div className="idea-detail">
          <EditableText
            className="notes-area"
            aria-label="Poznámky k nápadu"
            placeholder="Rozepsat nápad…"
            multiline
            table="ideas"
            rowId={idea.id}
            value={idea.notes ?? ''}
            onValueChange={(notes) => actions.update('ideas', idea.id, { notes }, true)}
          />
          <div className="idea-controls">
            <select
              aria-label="Produkt"
              value={idea.product_id ?? ''}
              onChange={(e) => actions.update('ideas', idea.id, { product_id: e.target.value || null })}
            >
              <option value="">Bez produktu</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.title || 'Bez názvu'}</option>
              ))}
            </select>
            <TagInput tags={idea.tags} onChange={(tags) => actions.update('ideas', idea.id, { tags })} />
          </div>
          <div className="idea-convert">
            <span>Převést na</span>
            <button type="button" className="btn-secondary" onClick={() => (location.hash = pageHref(actions.ideaToTask(idea)))}>Úkol</button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                actions.ideaToMilestone(idea);
                location.hash = '#/dev/roadmap';
              }}
            >
              Položku roadmapy
            </button>
            <button type="button" className="btn-secondary" onClick={() => (location.hash = pageHref(actions.ideaToJob(idea)))}>Zakázku</button>
            <button
              type="button"
              className="btn-quiet btn-quiet-danger"
              onClick={() => {
                if (window.confirm('Smazat tento nápad? Tuto akci nelze vrátit.')) actions.remove('ideas', idea.id);
              }}
            >
              Smazat
            </button>
          </div>
          <Comments type="idea" id={idea.id} />
        </div>
      )}
    </div>
  );
}

export function Ideas() {
  const { ideas, pages, members, actions } = useWorkspace();
  const [status, setStatus] = useState<IdeaStatus | 'open' | 'all'>('open');
  const [tag, setTag] = useState('');
  const [draft, setDraft] = useState('');
  const tags = [...new Set(ideas.flatMap((i) => i.tags ?? []))].sort();

  const visible = ideas
    .filter((i) => {
      if (status === 'open') return i.status === 'new' || i.status === 'considering' || i.status === 'approved';
      return status === 'all' || i.status === status;
    })
    .filter((i) => !tag || i.tags?.includes(tag))
    .sort((a, b) => (b.created_at ?? '￿').localeCompare(a.created_at ?? '￿'));

  const submit = () => {
    if (!draft.trim()) return;
    actions.createIdea(draft);
    setDraft('');
  };

  const exportCsv = () =>
    downloadCsv(
      'scanity-napady.csv',
      ['Nápad', 'Stav', 'Produkt', 'Autor', 'Vytvořeno', 'Štítky', 'Poznámky'],
      ideas.map((i) => [
        i.text,
        IDEA_STATUSES.find((s) => s.id === i.status)?.label,
        pages.find((p) => p.id === i.product_id)?.title,
        members.find((m) => m.user_id === i.created_by)?.name,
        i.created_at,
        i.tags,
        i.notes,
      ]),
    );

  return (
    <div className="view">
      <DevNav active="ideas" />
      <div className="toolbar">
        <h1>Nápady</h1>
        <select aria-label="Filtr podle stavu" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="open">Rozpracované</option>
          <option value="all">Všechny</option>
          {IDEA_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        {tags.length > 0 && (
          <select aria-label="Filtr podle štítku" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Všechny štítky</option>
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
        <ExportButton onClick={exportCsv} />
      </div>
      <div className="inline-add">
        <input
          placeholder="Zapsat nápad a stisknout Enter"
          aria-label="Nový nápad"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
      </div>
      {visible.length === 0 && <DevDrawerHint text="Žádný nápad tu není. Zapište první do pole výše nebo tlačítkem Přidat odkudkoli." />}
      <div className="idea-list">
        {visible.map((idea) => <IdeaRow key={idea.id} idea={idea} />)}
      </div>
    </div>
  );
}
