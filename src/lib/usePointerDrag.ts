import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export interface PointerDrag<T> {
  id: string;
  label: string;
  x: number;
  y: number;
  // Alt nebo Ctrl při puštění = kopie místo přesunu.
  copy: boolean;
  target: T | null;
}

const THRESHOLD_PX = 5;
const SCROLL_EDGE = 72;
const SCROLL_STEP = 10;

// Přetahování přes pointer events, funguje i na dotyku. Drag začne až po pohybu o pár pixelů,
// takže obyčejný klik na stejném prvku dál funguje.
export function usePointerDrag<T>(
  resolve: (x: number, y: number, id: string) => T | null,
  onDrop: (id: string, target: T, copy: boolean) => void,
) {
  const [drag, setDrag] = useState<PointerDrag<T> | null>(null);
  const handlers = useRef({ resolve, onDrop });
  handlers.current = { resolve, onDrop };
  const suppressClick = useRef(false);

  const startDrag = useCallback((event: ReactPointerEvent, id: string, label: string) => {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const scroller = (event.currentTarget as HTMLElement).closest('.main');
    let current: PointerDrag<T> | null = null;
    let last = { x: startX, y: startY, copy: false };

    const update = () => {
      if (!current) return;
      current = { ...current, ...last, target: handlers.current.resolve(last.x, last.y, id) };
      setDrag(current);
    };
    const scrollTimer = setInterval(() => {
      if (!current || !scroller) return;
      const rect = scroller.getBoundingClientRect();
      const delta = last.y < rect.top + SCROLL_EDGE ? -SCROLL_STEP : last.y > rect.bottom - SCROLL_EDGE ? SCROLL_STEP : 0;
      if (delta) {
        scroller.scrollTop += delta;
        update();
      }
    }, 16);

    const onMove = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY, copy: e.altKey || e.ctrlKey || e.metaKey };
      if (!current) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < THRESHOLD_PX) return;
        current = { id, label, ...last, target: null };
        document.body.classList.add('is-dragging');
        window.getSelection()?.removeAllRanges();
      }
      e.preventDefault();
      update();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false);
      else if (current) {
        last = { ...last, copy: e.altKey || e.ctrlKey || e.metaKey };
        update();
      }
    };
    const finish = (drop: boolean) => {
      clearInterval(scrollTimer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      document.body.classList.remove('is-dragging');
      const done = current;
      current = null;
      setDrag(null);
      if (!done) return;
      // Po přetažení prohlížeč pošle ještě klik, ten nesmí otevřít odkaz pod kurzorem.
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
      if (drop && done.target) handlers.current.onDrop(id, done.target, last.copy);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
  }, []);

  // Patří na onClickCapture kontejneru, zahodí klik, který dokončil přetažení.
  const onClickCapture = useCallback((event: React.MouseEvent) => {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return { drag, startDrag, onClickCapture };
}

// Pozice mezi sousedy v cílovém seznamu (bez přetahovaného prvku).
export function dropIndex(el: Element | null, selector: string, x: number, y: number, horizontal: boolean) {
  const item = el?.closest<HTMLElement>(selector);
  if (!item) return null;
  const rect = item.getBoundingClientRect();
  const before = horizontal ? x < rect.left + rect.width / 2 : y < rect.top + rect.height / 2;
  return { item, before };
}
