import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export interface DropTarget {
  sectionId: string | null;
  overTaskId: string | null;
  before: boolean;
}

export interface DragState {
  taskId: string;
  text: string;
  x: number;
  y: number;
  target: DropTarget | null;
}

const SCROLL_EDGE = 72;
const SCROLL_STEP = 10;

function findTarget(x: number, y: number, taskId: string): DropTarget | null {
  const el = document.elementFromPoint(x, y);
  const sectionEl = el?.closest<HTMLElement>('[data-section-id]');
  if (!sectionEl) return null;
  const sectionId = sectionEl.dataset.sectionId || null;
  const rowEl = el?.closest<HTMLElement>('[data-task-row]');
  const overId = rowEl?.dataset.taskRow;
  if (!rowEl || !overId || overId === taskId) {
    return overId === taskId ? null : { sectionId, overTaskId: null, before: false };
  }
  const rect = rowEl.getBoundingClientRect();
  return { sectionId, overTaskId: overId, before: y < rect.top + rect.height / 2 };
}

// Vlastní drag přes pointer events, HTML5 drag & drop na dotykových zařízeních nefunguje.
export function useTaskDrag(onDrop: (taskId: string, target: DropTarget) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const startDrag = useCallback((event: ReactPointerEvent, taskId: string, text: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const scroller = event.currentTarget.closest('.main');
    let current: DragState = { taskId, text, x: event.clientX, y: event.clientY, target: null };
    setDrag(current);
    document.body.classList.add('is-dragging');

    const updatePointer = (x: number, y: number) => {
      current = { ...current, x, y, target: findTarget(x, y, taskId) };
      setDrag(current);
    };
    const scrollTimer = setInterval(() => {
      if (!scroller) return;
      const rect = scroller.getBoundingClientRect();
      let delta = 0;
      if (current.y < rect.top + SCROLL_EDGE) delta = -SCROLL_STEP;
      else if (current.y > rect.bottom - SCROLL_EDGE) delta = SCROLL_STEP;
      if (delta) {
        scroller.scrollTop += delta;
        updatePointer(current.x, current.y);
      }
    }, 16);

    const onMove = (e: PointerEvent) => updatePointer(e.clientX, e.clientY);
    const finish = (drop: boolean) => {
      clearInterval(scrollTimer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('is-dragging');
      setDrag(null);
      if (drop && current.target) onDropRef.current(taskId, current.target);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
  }, []);

  return { drag, startDrag };
}
