import { useState } from 'react';
import { formatDateTime } from '../lib/format';
import type { CommentTarget } from '../lib/types';
import { useWorkspace } from '../lib/useWorkspace';
import { Icon } from './Icon';

interface Props {
  type: CommentTarget;
  id: string;
  /** Další záznamy zobrazené ve stejné historii, např. komentáře zakázek firmy. */
  relatedIds?: string[];
  title?: string;
  placeholder?: string;
}

export function Comments({ type, id, relatedIds = [], title = 'Komentáře', placeholder = 'Napsat komentář…' }: Props) {
  const { comments, members, me, actions } = useWorkspace();
  const [draft, setDraft] = useState('');
  const ids = new Set([id, ...relatedIds]);
  const items = comments
    .filter((c) => ids.has(c.target_id))
    .sort((a, b) => (a.created_at ?? '￿').localeCompare(b.created_at ?? '￿'));

  const submit = () => {
    if (!draft.trim()) return;
    actions.addComment(type, id, draft.trim());
    setDraft('');
  };

  return (
    <section className="comments">
      <h3>{title}</h3>
      {items.map((comment) => {
        const author = members.find((m) => m.user_id === comment.author);
        return (
          <div className={`comment ${comment.system ? 'is-system' : ''}`} key={comment.id}>
            <div className="comment-meta">
              <span>{author?.name ?? 'Neznámý člen'}</span>
              {comment.created_at && <time>{formatDateTime(comment.created_at)}</time>}
              {comment.author === me.user_id && !comment.system && (
                <button type="button" className="icon-btn" aria-label="Smazat komentář" onClick={() => actions.deleteComment(comment.id)}>
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
            <p>{comment.body}</p>
          </div>
        );
      })}
      <div className="comment-form">
        <textarea
          rows={2}
          placeholder={placeholder}
          aria-label={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
          }}
        />
        <button type="button" className="btn-secondary" disabled={!draft.trim()} onClick={submit}>Přidat</button>
      </div>
    </section>
  );
}
