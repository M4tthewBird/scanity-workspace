const TASK_SELECTOR = '[data-task-input]';

export function focusElement(selector: string, select = false) {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLTextAreaElement>(selector);
    if (!el) return;
    el.focus();
    if (select) el.select();
    else el.setSelectionRange(el.value.length, el.value.length);
  });
}

export function focusTask(id: string) {
  focusElement(`[data-task-input="${id}"]`);
}

// Vrací id úkolu před/za aktuálním v pořadí, jak jsou zobrazené na stránce.
export function adjacentTaskId(id: string, direction: -1 | 1): string | null {
  const inputs = [...document.querySelectorAll<HTMLElement>(TASK_SELECTOR)];
  const index = inputs.findIndex((el) => el.dataset.taskInput === id);
  return inputs[index + direction]?.dataset.taskInput ?? null;
}
