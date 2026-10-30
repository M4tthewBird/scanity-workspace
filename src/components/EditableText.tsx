import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, TextareaHTMLAttributes } from 'react';
import { useWorkspace } from '../lib/useWorkspace';
import type { TableName } from '../lib/types';

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'onInput'> {
  value: string;
  table: TableName;
  rowId: string;
  onValueChange: (value: string) => void;
  multiline?: boolean;
  [dataAttribute: `data-${string}`]: string | undefined;
}

// Textové pole bez rámečku. Během editace drží vlastní hodnotu, aby ho nepřepsaly změny kolegů.
export function EditableText({ value, table, rowId, onValueChange, multiline, onKeyDown, ...rest }: Props) {
  const { actions } = useWorkspace();
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(fit, [draft]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Řádek může zmizet i s fokusem (např. smazání), zápis i držený fokus se musí uvolnit.
  useEffect(() => () => actions.blurRow(table, rowId), [actions, table, rowId]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!multiline && event.key === 'Enter') event.preventDefault();
    onKeyDown?.(event);
  };

  return (
    <textarea
      {...rest}
      ref={ref}
      rows={1}
      value={draft}
      onKeyDown={handleKeyDown}
      onFocus={() => {
        setEditing(true);
        actions.focusRow(table, rowId);
      }}
      onBlur={() => {
        setEditing(false);
        actions.blurRow(table, rowId);
      }}
      onChange={(event) => {
        const next = multiline ? event.target.value : event.target.value.replace(/\r?\n/g, ' ');
        setDraft(next);
        onValueChange(next);
      }}
    />
  );
}
