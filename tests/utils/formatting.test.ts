import {
  chunk,
  compareWorkItems,
  isHighPriority,
  isOverdue,
  priorityRank,
  sortWorkItems,
  toStatusCategory,
} from '../../src/utils/formatting';
import type { WorkItem } from '../../src/types/domain';

const item = (key: string, over: Partial<WorkItem> = {}): WorkItem => ({
  key,
  summary: key,
  status: 'To Do',
  statusCategory: 'todo',
  isOverdue: false,
  source: 'jira',
  ...over,
});

describe('toStatusCategory', () => {
  it('maps Jira status category keys', () => {
    expect(toStatusCategory('new')).toBe('todo');
    expect(toStatusCategory('indeterminate')).toBe('in_progress');
    expect(toStatusCategory('done')).toBe('done');
    expect(toStatusCategory('DONE')).toBe('done');
  });
  it('returns unknown for missing or unexpected values', () => {
    expect(toStatusCategory(undefined)).toBe('unknown');
    expect(toStatusCategory(null)).toBe('unknown');
    expect(toStatusCategory('weird')).toBe('unknown');
  });
});

describe('priority helpers', () => {
  it('ranks standard priorities, case-insensitively', () => {
    expect(priorityRank('Highest')).toBeLessThan(priorityRank('High'));
    expect(priorityRank('high')).toBeLessThan(priorityRank('Medium'));
    expect(priorityRank('Medium')).toBeLessThan(priorityRank('Low'));
  });
  it('places unknown priorities between Medium and Low', () => {
    expect(priorityRank('P2-Custom')).toBeGreaterThan(priorityRank('Medium'));
    expect(priorityRank(undefined)).toBeLessThan(priorityRank('Low'));
  });
  it('identifies high priority', () => {
    expect(isHighPriority('Highest')).toBe(true);
    expect(isHighPriority('High')).toBe(true);
    expect(isHighPriority('Medium')).toBe(false);
    expect(isHighPriority(undefined)).toBe(false);
  });
});

describe('isOverdue', () => {
  const now = new Date('2026-11-15T12:00:00Z');
  it('is true for a past due date on open work', () => {
    expect(isOverdue('2026-11-14', 'todo', now)).toBe(true);
  });
  it('is false for today, future dates, done work and missing dates', () => {
    expect(isOverdue('2026-11-15', 'todo', now)).toBe(false);
    expect(isOverdue('2026-12-01', 'in_progress', now)).toBe(false);
    expect(isOverdue('2026-01-01', 'done', now)).toBe(false);
    expect(isOverdue(undefined, 'todo', now)).toBe(false);
    expect(isOverdue('not-a-date', 'todo', now)).toBe(false);
  });
  it('handles full ISO timestamps from Teamwork Graph', () => {
    expect(isOverdue('2026-11-10T00:00:00.000Z', 'todo', now)).toBe(true);
  });
});

describe('sortWorkItems', () => {
  it('orders overdue, then priority, then in-progress, then due date, then recency', () => {
    const items = [
      item('A-1', { priority: 'Low' }),
      item('A-2', { priority: 'High' }),
      item('A-3', { priority: 'Low', isOverdue: true }),
      item('A-4', { priority: 'High', statusCategory: 'in_progress' }),
      item('A-5', { priority: 'Medium', dueDate: '2026-12-01' }),
      item('A-6', { priority: 'Medium', dueDate: '2026-11-20' }),
    ];
    expect(sortWorkItems(items).map((i) => i.key)).toEqual([
      'A-3',
      'A-4',
      'A-2',
      'A-6',
      'A-5',
      'A-1',
    ]);
  });
  it('does not mutate the input', () => {
    const items = [item('B-2', { priority: 'Low' }), item('B-1', { priority: 'High' })];
    sortWorkItems(items);
    expect(items[0].key).toBe('B-2');
  });
  it('prefers the more recently updated item on ties', () => {
    const a = item('C-1', { updated: '2026-11-01' });
    const b = item('C-2', { updated: '2026-11-10' });
    expect(compareWorkItems(a, b)).toBeGreaterThan(0);
  });
});

describe('chunk', () => {
  it('chunks lists', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
