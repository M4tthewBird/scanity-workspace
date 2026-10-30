import { useEffect, useRef, useState } from 'react';
import { pageHref } from '../lib/useRoute';
import type { Route } from '../lib/useRoute';
import { parseContact } from '../lib/text';
import { useWorkspace } from '../lib/useWorkspace';
import { Icon } from './Icon';

type Kind = 'idea' | 'task' | 'contact' | 'job';

const KINDS: { id: Kind; label: string; placeholder: string }[] = [
  { id: 'idea', label: 'Nápad', placeholder: 'Co vás napadlo?' },
  { id: 'task', label: 'Úkol', placeholder: 'Co je potřeba udělat?' },
  { id: 'contact', label: 'Kontakt', placeholder: 'Jméno, firma, e-mail, telefon' },
  { id: 'job', label: 'Zakázka', placeholder: 'Název zakázky' },
];

export interface Toast {
  message: string;
  href?: string;
}

export function QuickAdd({ route, onClose, onDone }: { route: Route; onClose: () => void; onDone: (toast: Toast) => void }) {
  const { pages, actions } = useWorkspace();
  const [kind, setKind] = useState<Kind>('idea');
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const current = KINDS.find((k) => k.id === kind)!;

  useEffect(() => inputRef.current?.focus(), [kind]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    if (kind === 'idea') {
      const page = route.name === 'page' ? pages.find((p) => p.id === route.id) : undefined;
      actions.createIdea(value, page?.kind === 'product' ? page.id : null);
      onDone({ message: 'Nápad uložen', href: '#/dev/ideas' });
    } else if (kind === 'task') {
      const page = route.name === 'page' ? pages.find((p) => p.id === route.id) : undefined;
      const pageId = page?.id ?? actions.defaultProductId();
      actions.createTask(pageId, null, undefined, null, { text: value });
      onDone({ message: 'Úkol uložen', href: pageHref(pageId) });
    } else if (kind === 'contact') {
      const parsed = parseContact(value);
      const id = actions.ensureContact({
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
        companyId: actions.ensureCompany(parsed.companyName),
      });
      onDone({ message: 'Kontakt uložen', href: id ? `#/crm/contact/${id}` : '#/crm' });
    } else {
      const id = actions.createJob({ title: value });
      onDone({ message: 'Zakázka uložena', href: pageHref(id) });
    }
    onClose();
  };

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="quick-add" role="dialog" aria-label="Rychle přidat">
        <div className="segmented" role="group" aria-label="Typ záznamu">
          {KINDS.map((k) => (
            <button type="button" key={k.id} className={kind === k.id ? 'is-active' : ''} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
              {k.label}
            </button>
          ))}
        </div>
        <textarea
          ref={inputRef}
          rows={3}
          placeholder={current.placeholder}
          aria-label={current.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="quick-add-footer">
          <button type="button" className="btn-quiet" onClick={onClose}>Zrušit</button>
          <button type="button" className="btn-primary" disabled={!text.trim()} onClick={submit}>
            <Icon name="check" size={16} /> Uložit
          </button>
        </div>
      </div>
    </>
  );
}
