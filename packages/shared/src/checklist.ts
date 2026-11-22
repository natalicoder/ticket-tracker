import type { ChecklistProgress } from './dto.js';

const ITEM = /^(\s*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\])/;
const FENCE = /^\s*(`{3,}|~{3,})/;

/** Calls `visit` for every task-list line outside fenced code blocks. */
function forEachItem(lines: string[], visit: (lineIndex: number, match: RegExpExecArray, itemIndex: number) => void): void {
  let fence: string | null = null;
  let item = 0;
  lines.forEach((line, i) => {
    const f = FENCE.exec(line);
    if (f) {
      const marker = f[1]!;
      if (fence === null) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      return;
    }
    if (fence !== null) return;
    const m = ITEM.exec(line);
    if (m) visit(i, m, item++);
  });
}

export function countChecklist(body: string): ChecklistProgress {
  let done = 0;
  let total = 0;
  forEachItem(body.split('\n'), (_i, m) => {
    total++;
    if (m[2] !== ' ') done++;
  });
  return { done, total };
}

/** Flips the `index`-th checklist item (0-based, in document order). Out-of-range indexes leave the body unchanged. */
export function toggleChecklistItem(body: string, index: number): string {
  const lines = body.split('\n');
  forEachItem(lines, (i, m, itemIndex) => {
    if (itemIndex !== index) return;
    const next = m[2] === ' ' ? 'x' : ' ';
    lines[i] = m[1] + next + m[3] + lines[i]!.slice(m[0].length);
  });
  return lines.join('\n');
}
