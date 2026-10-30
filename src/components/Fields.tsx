import { useEffect, useState } from 'react';
import type { InputHTMLAttributes, KeyboardEvent } from 'react';
import { useWorkspace } from '../lib/useWorkspace';
import { Icon } from './Icon';

interface CommitInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onCommit: (value: string) => void;
}

// Pole, které se uloží až po opuštění nebo Enteru. Klient a kontakt se tím založí až po dopsání celého jména.
export function CommitInput({ value, onCommit, onKeyDown, ...rest }: CommitInputProps) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    if (draft.trim() !== value) onCommit(draft.trim());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    onKeyDown?.(event);
  };

  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={() => {
        setEditing(false);
        commit();
      }}
      onKeyDown={handleKeyDown}
    />
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field-row">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const { tasks, ideas, pages } = useWorkspace();
  const [draft, setDraft] = useState('');
  const known = [...new Set([...tasks, ...ideas, ...pages].flatMap((row) => row.tags ?? []))].sort();
  const current = tags ?? [];

  const add = () => {
    const tag = draft.trim().replace(/,$/, '');
    if (tag && !current.includes(tag)) onChange([...current, tag]);
    setDraft('');
  };

  return (
    <div className="tag-input">
      {current.map((tag) => (
        <span className="tag" key={tag}>
          {tag}
          <button type="button" aria-label={`Odebrat štítek ${tag}`} onClick={() => onChange(current.filter((t) => t !== tag))}>
            <Icon name="close" size={12} />
          </button>
        </span>
      ))}
      <input
        list="known-tags"
        placeholder="Přidat štítek"
        aria-label="Přidat štítek"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          }
        }}
      />
      <datalist id="known-tags">
        {known.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </div>
  );
}

export function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn-quiet" onClick={onClick}>
      <Icon name="download" size={16} /> Export CSV
    </button>
  );
}
