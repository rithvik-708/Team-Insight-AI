jest.mock('@forge/api', () => require('../helpers/forgeMock').forgeApiMock);

import {
  SERVER_INFO,
  connection,
  graphWorkItem,
  jiraCalls,
  jiraIssue,
  onGraph,
  onJira,
  resetMocks,
} from '../helpers/forgeMock';
import { myWorkSummary, suggestFocus } from '../../src/actions/myWorkSummary';
import { resetSiteInfoCache } from '../../src/services/jira/client';
import type { WorkItem } from '../../src/types/domain';

const ctx = { accountId: 'me-1', cloudId: 'cloud-1' };
const me = { accountId: 'me-1', displayName: 'Dana Dev' };

beforeEach(() => {
  resetMocks();
  resetSiteInfoCache();
  onJira(/serverInfo/, SERVER_INFO);
  onJira(/myself/, { body: me });
});

describe('myWorkSummary', () => {
  it('uses Teamwork Graph items enriched with Jira priority and project', async () => {
    onGraph(
      'teamworkInsight_assignedWorkItems',
      connection('atlassianUserAssignedJiraWorkItems', [
        graphWorkItem('MKT-21', 'In Progress', 'indeterminate'),
        graphWorkItem('MKT-22', 'To Do', 'new'),
        graphWorkItem('MKT-1', 'Done', 'done'),
      ]),
    );
    onJira(/search\/jql/, {
      body: {
        issues: [
          jiraIssue('MKT-21', {
            priority: 'High',
            status: 'In Progress',
            category: 'indeterminate',
          }),
          jiraIssue('MKT-22', { priority: 'Medium' }),
        ],
        isLast: true,
      },
    });

    const result = await myWorkSummary(ctx);

    expect(result.user).toEqual(me);
    expect(result.items.map((i) => i.key)).toEqual(['MKT-21', 'MKT-22']);
    expect(result.items[0]).toMatchObject({
      priority: 'High',
      project: { key: 'MKT' },
      source: 'teamworkGraph',
    });
    expect(result.totals).toEqual({ open: 2, highPriority: 1, overdue: 0, inProgress: 1 });
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'teamworkGraph', status: 'ok' }),
        expect.objectContaining({ source: 'jira', status: 'ok' }),
      ]),
    );
    const jql = decodeURIComponent(jiraCalls(/search\/jql/)[0].target);
    expect(jql).toContain('assignee = currentUser() AND statusCategory != Done');
  });

  it('drops stale graph items that Jira no longer reports as open and assigned', async () => {
    onGraph(
      'teamworkInsight_assignedWorkItems',
      connection('atlassianUserAssignedJiraWorkItems', [graphWorkItem('MKT-5')]),
    );
    onJira(/search\/jql/, { body: { issues: [], isLast: true } });
    const result = await myWorkSummary(ctx);
    expect(result.items).toHaveLength(0);
    expect(result.notes.join(' ')).toMatch(/closed or reassigned/);
  });

  it('adds Jira-only items and labels their source', async () => {
    onGraph(
      'teamworkInsight_assignedWorkItems',
      connection('atlassianUserAssignedJiraWorkItems', []),
    );
    onJira(/search\/jql/, {
      body: { issues: [jiraIssue('MKT-30', { priority: 'Low' })], isLast: true },
    });
    const result = await myWorkSummary(ctx);
    expect(result.items).toEqual([expect.objectContaining({ key: 'MKT-30', source: 'jira' })]);
    expect(result.sources.find((s) => s.source === 'teamworkGraph')?.status).toBe('empty');
  });

  it('falls back to Jira when Teamwork Graph fails', async () => {
    onGraph('teamworkInsight_assignedWorkItems', { status: 403, body: {} });
    onJira(/search\/jql/, {
      body: { issues: [jiraIssue('MKT-7', { priority: 'High' })], isLast: true },
    });
    const result = await myWorkSummary(ctx);
    expect(result.items.map((i) => i.key)).toEqual(['MKT-7']);
    expect(result.sources.find((s) => s.source === 'teamworkGraph')).toMatchObject({
      status: 'error',
    });
    expect(result.notes.join(' ')).toMatch(/Teamwork Graph was unavailable/);
  });

  it('throws when both sources fail', async () => {
    onGraph('teamworkInsight_assignedWorkItems', { status: 500, body: {} });
    onJira(/search\/jql/, { status: 403 });
    await expect(myWorkSummary(ctx)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('returns an empty result when the user has no work', async () => {
    onGraph(
      'teamworkInsight_assignedWorkItems',
      connection('atlassianUserAssignedJiraWorkItems', []),
    );
    onJira(/search\/jql/, { body: { issues: [], isLast: true } });
    const result = await myWorkSummary(ctx);
    expect(result.items).toEqual([]);
    expect(result.totals.open).toBe(0);
    expect(result.suggestedFocus).toEqual([]);
  });

  it('applies the limit and project filter', async () => {
    onGraph(
      'teamworkInsight_assignedWorkItems',
      connection('atlassianUserAssignedJiraWorkItems', [
        graphWorkItem('OPS-1'),
        graphWorkItem('MKT-1'),
        graphWorkItem('MKT-2'),
      ]),
    );
    onJira(/search\/jql/, {
      body: { issues: [jiraIssue('MKT-1'), jiraIssue('MKT-2')], isLast: true },
    });
    const result = await myWorkSummary(ctx, { limit: 1, projectKey: 'MKT' });
    expect(result.items).toHaveLength(1);
    expect(result.truncated).toBe(true);
    expect(result.totals.open).toBe(2);
    expect(decodeURIComponent(jiraCalls(/search\/jql/)[0].target)).toContain('project = "MKT"');
  });
});

describe('suggestFocus', () => {
  const base = (key: string, over: Partial<WorkItem>): WorkItem => ({
    key,
    summary: key,
    status: 'To Do',
    statusCategory: 'todo',
    isOverdue: false,
    source: 'jira',
    ...over,
  });

  it('ranks overdue, then high-priority in-progress work, with reasons', () => {
    const result = suggestFocus([
      base('A-1', { priority: 'Low' }),
      base('A-2', { priority: 'High', statusCategory: 'in_progress' }),
      base('A-3', { priority: 'Medium', isOverdue: true, dueDate: '2026-01-01' }),
    ]);
    expect(result.map((r) => r.key)).toEqual(['A-3', 'A-2', 'A-1']);
    expect(result[0].reasons[0]).toContain('overdue');
    expect(result[1].reasons).toEqual(['High priority', 'already in progress']);
    expect(result[2].reasons).toEqual(['next in priority order']);
  });
});
