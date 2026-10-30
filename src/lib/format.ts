export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function isOverdue(due: string | null, done: boolean): boolean {
  return Boolean(due) && !done && due! < todayIso();
}

export function formatDue(due: string): string {
  const [year, month, day] = due.split('-').map(Number);
  const suffix = year === new Date().getFullYear() ? '' : ` ${year}`;
  return `${day}. ${month}.${suffix}`;
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' });
}

export function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}
