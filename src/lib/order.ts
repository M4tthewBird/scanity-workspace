export const STEP = 1024;

const MIN_GAP = 1e-6;

export function between(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return STEP;
  if (before === undefined) return after! - STEP;
  if (after === undefined) return before + STEP;
  return (before + after) / 2;
}

export function hasGap(before?: number, after?: number): boolean {
  return before === undefined || after === undefined || Math.abs(after - before) > MIN_GAP;
}

export function byPosition<T extends { position: number }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.position - b.position);
}
