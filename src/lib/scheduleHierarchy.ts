import type { ScheduleRow } from '@/store/projectStore';

/** Computes hierarchical OutlineNumber (1, 1.1, 1.1.2, …) based on outlineLevel order. */
export const computeOutlineNumbers = (rows: ScheduleRow[]): ScheduleRow[] => {
  const counters: number[] = [];
  return rows.map((r) => {
    const level = Math.max(1, r.outlineLevel ?? 1);
    if (counters.length < level) {
      while (counters.length < level) counters.push(0);
    } else {
      counters.length = level;
    }
    counters[level - 1] = (counters[level - 1] || 0) + 1;
    const outlineNumber = r.outlineNumber && r.outlineNumber.trim() ? r.outlineNumber : counters.slice(0, level).join('.');
    return { ...r, outlineNumber };
  });
};

/** True if the next row has a deeper level than row at i. */
export const rowHasChildren = (rows: ScheduleRow[], i: number): boolean => {
  const lvl = rows[i].outlineLevel ?? 1;
  const next = rows[i + 1];
  return !!next && (next.outlineLevel ?? 1) > lvl;
};

/**
 * Returns the indices of rows that should be visible given a max-level filter
 * and a set of explicitly-collapsed row indices.
 */
export const computeVisibleIndices = (
  rows: ScheduleRow[],
  maxLevel: number,
  collapsed: Set<number>,
): number[] => {
  const out: number[] = [];
  const stack: number[] = []; // ancestor indices
  for (let i = 0; i < rows.length; i++) {
    const lvl = Math.max(1, Number(rows[i].outlineLevel) || 1);
    while (stack.length && (rows[stack[stack.length - 1]].outlineLevel ?? 1) >= lvl) stack.pop();
    const exceedsMax = lvl > maxLevel;
    const hiddenByAncestor = stack.some((a) => collapsed.has(a));
    const ancestorExceeds = stack.some((a) => (Math.max(1, Number(rows[a].outlineLevel) || 1)) > maxLevel);
    if (!exceedsMax && !hiddenByAncestor && !ancestorExceeds) out.push(i);
    stack.push(i);
  }
  return out;
};
