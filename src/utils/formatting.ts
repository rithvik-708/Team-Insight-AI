import type { StatusCategory, WorkItem } from '../types/domain';

/** Jira status category keys are `new`, `indeterminate` and `done` (in both REST and Teamwork Graph). */
export function toStatusCategory(key: string | undefined | null): StatusCategory {
  switch ((key ?? '').trim().toLowerCase()) {
    case 'new':
    case 'to do':
    case 'todo':
      return 'todo';
    case 'indeterminate':
    case 'in progress':
      return 'in_progress';
    case 'done':
    case 'complete':
      return 'done';
    default:
      return 'unknown';
  }
}

const PRIORITY_RANK: Record<string, number> = {
  blocker: 0,
  highest: 1,
  critical: 1,
  high: 2,
  major: 2,
  medium: 3,
  low: 4,
  minor: 4,
  lowest: 5,
  trivial: 5,
};

/** Lower is more urgent. Unknown or custom priority names sort after Medium and before Low. */
export function priorityRank(priority: string | undefined): number {
  if (!priority) return 3.5;
  return PRIORITY_RANK[priority.trim().toLowerCase()] ?? 3.5;
}

export function isHighPriority(priority: string | undefined): boolean {
  return priorityRank(priority) <= 2;
}

/** Compares calendar dates (the YYYY-MM-DD prefix) so timezone offsets can't flip the result. */
export function isOverdue(
  dueDate: string | undefined,
  category: StatusCategory,
  now: Date = new Date(),
): boolean {
  if (!dueDate || category === 'done') return false;
  const due = dueDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
  return due < now.toISOString().slice(0, 10);
}

const CATEGORY_RANK: Record<StatusCategory, number> = {
  in_progress: 0,
  todo: 1,
  unknown: 2,
  done: 3,
};

/** Overdue first, then priority, then in-progress before to-do, then earliest due date, then most recently updated. */
export function compareWorkItems(a: WorkItem, b: WorkItem): number {
  if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
  const p = priorityRank(a.priority) - priorityRank(b.priority);
  if (p !== 0) return p;
  const c = CATEGORY_RANK[a.statusCategory] - CATEGORY_RANK[b.statusCategory];
  if (c !== 0) return c;
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    return a.dueDate ? -1 : 1;
  }
  return (b.updated ?? '').localeCompare(a.updated ?? '');
}

export function sortWorkItems(items: WorkItem[]): WorkItem[] {
  return [...items].sort(compareWorkItems);
}

export function browseUrl(siteUrl: string | undefined, key: string): string | undefined {
  if (!siteUrl) return undefined;
  return `${siteUrl.replace(/\/+$/, '')}/browse/${encodeURIComponent(key)}`;
}

/** Splits a list into chunks (used to batch JQL `assignee in (...)` queries). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
