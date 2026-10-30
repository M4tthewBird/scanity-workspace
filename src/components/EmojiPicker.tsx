import { useEffect, useRef, useState } from 'react';

const EMOJIS = [
  '📄', '📝', '📌', '📦', '📁', '📊', '📅', '📷', '🎥', '🎬', '🖼️', '🎨',
  '🏡', '🏢', '🏛️', '🏰', '🏗️', '⛪', '🌐', '🗺️', '📍', '🧭', '🚀', '⚡',
  '⚙️', '🔧', '🛠️', '💻', '📱', '🖥️', '🤖', '🧠', '✨', '🔥', '💡', '🔍',
  '✅', '🎯', '⭐', '❤️', '💰', '🧾', '📣', '🤝', '👥', '🧪', '🪖', '🌱',
];

export function EmojiPicker({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="emoji-picker" ref={ref}>
      <button
        type="button"
        className="page-icon"
        aria-label="Změnit ikonu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {value}
      </button>
      {open && (
        <div className="emoji-grid">
          {EMOJIS.map((emoji) => (
            <button
              type="button"
              key={emoji}
              aria-label={`Ikona ${emoji}`}
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
