jest.mock('@forge/api', () => require('../helpers/forgeMock').forgeApiMock);

import {
  SERVER_INFO,
  connection,
  jiraCalls,
  jiraIssue,
  onGraph,
  onJira,
  resetMocks,
} from '../helpers/forgeMock';
import { aggregateWorkload, selectTeam, teamWorkload } from '../../src/actions/teamWorkload';
import { resetSiteInfoCache } from '../../src/services/jira/client';
import type { TeamRef, WorkItem } from '../../src/types/domain';

const ctx = { accountId: 'me-1' };
const team = (id: string, name: string) => ({
  __typename: 'AtlassianTeam',
  id: `ari:cloud:identity::team/${id}`,
  displayName: name,
});
const alice = { accountId: 'a1', displayName: 'Alice' };
const bob = { accountId: 'b2', displayName: 'Bob' };

beforeEach(() => {
  resetMocks();
  resetSiteInfoCache();
  onJira(/serverInfo/, SERVER_INFO);
});

describe('selectTeam', () => {
  const teams: TeamRef[] = [
    { id: 't1', name: 'Web Platform' },
    { id: 't2', name: 'Web Design' },
    { id: 't3', name: 'Data' },
  ];
  it('never silently picks the first of several teams', () => {
    expect(selectTeam(teams, {})).toEqual({ kind: 'ambiguous', candidates: teams });
  });
  it('selects the only team', () => {
    expect(selectTeam([teams[2]], {})).toEqual({ kind: 'selected', team: teams[2] });
  });
  it('matches names exactly, then partially, case-insensitively', () => {
    expect(selectTeam(teams, { teamName: 'data' })).toMatchObject({
      kind: 'selected',
      team: { id: 't3' },
    });
    expect(selectTeam(teams, { teamName: 'platform' })).toMatchObject({
      kind: 'selected',
      team: { id: 't1' },
    });
    expect(selectTeam(teams, { teamName: 'web' })).toMatchObject({ kind: 'ambiguous' });
    expect(selectTeam(teams, { teamName: 'finance' })).toEqual({ kind: 'none' });
  });
  it('accepts an explicit team id', () => {
    expect(selectTeam(teams, { teamId: 't2' })).toMatchObject({
      kind: 'selected',
      team: { name: 'Web Design' },
    });
    expect(selectTeam([], { teamId: 'tx' })).toMatchObject({
      kind: 'selected',
      team: { id: 'tx' },
    });
  });
  it('returns none when the user has no teams', () => {
    expect(selectTeam([], {})).toEqual({ kind: 'none' });
  });
});

describe('aggregateWorkload', () => {
  const w = (key: string, assignee: typeof alice, over: Partial<WorkItem> = {}): WorkItem => ({
    key,
    summary: key,
    status: 'To Do',
    statusCategory: 'todo',
    isOverdue: false,
    source: 'jira',
    assignee,
    ...over,
  });

  it('counts per member, flags high load and members without assigned work', () => {
    const carol = { accountId: 'c3', displayName: 'Carol' };
    const items = [
      ...Array.from({ length: 6 }, (_, i) =>
        w(
          `A-${i + 1}`,
          alice,
          i < 2 ? { statusCategory: 'in_progress', status: 'In Progress' } : {},
        ),
      ),
      w('B-1', bob, { priority: 'Highest' }),
      w('X-1', { accountId: 'outsider', displayName: 'Outsider' }),
    ];
    const result = aggregateWorkload([alice, bob, carol], items);
    expect(result.totals).toMatchObject({ open: 7, members: 3, averagePerMember: 2.3 });
    expect(result.totals.statusDistribution).toEqual({ 'To Do': 5, 'In Progress': 2 });
    expect(result.members.map((m) => [m.displayName, m.openCount, m.loadFlag])).toEqual([
      ['Alice', 6, 'high'],
      ['Bob', 1, 'normal'],
      ['Carol', 0, 'none'],
    ]);
    expect(result.members[0]).toMatchObject({ inProgressCount: 2, todoCount: 4 });
    expect(result.highLoadMembers).toEqual(['Alice']);
    expect(result.membersWithoutWork).toEqual(['Carol']);
    expect(result.topPriorityItems.map((i) => i.key)).toEqual(['B-1']);
  });

  it('handles an empty team', () => {
    expect(aggregateWorkload([], [])).toMatchObject({
      members: [],
      totals: { open: 0, averagePerMember: 0 },
    });
  });
});

describe('teamWorkload', () => {
  it('discovers the team via Graph and aggregates via a batched JQL query', async () => {
    onGraph(
      'teamworkInsight_userTeams',
      connection('atlassianUserInTeams', [team('t1', 'Marketing Squad')]),
    );
    onGraph(
      'teamworkInsight_teamMembers',
      connection('atlassianTeamMembers', [
        { __typename: 'AtlassianUser', accountId: 'a1', name: 'Alice' },
        { __typename: 'AtlassianUser', accountId: 'b2', name: 'Bob' },
      ]),
    );
    onJira(/search\/jql/, {
      body: {
        issues: [
          jiraIssue('MKT-1', { assignee: alice }),
          jiraIssue('MKT-2', { assignee: bob, priority: 'High' }),
        ],
        isLast: true,
      },
    });

    const result = await teamWorkload(ctx);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.scope).toEqual({
      kind: 'team',
      team: expect.objectContaining({ name: 'Marketing Squad' }),
    });
    expect(result.members.map((m) => m.openCount)).toEqual([1, 1]);
    expect(result.disclaimer).toMatch(/not a measure/);
    const jql = decodeURIComponent(jiraCalls(/search\/jql/)[0].target);
    expect(jql).toContain('assignee in ("a1", "b2") AND statusCategory != Done');
  });

  it('asks the user to choose when they belong to several teams', async () => {
    onGraph(
      'teamworkInsight_userTeams',
      connection('atlassianUserInTeams', [team('t1', 'A'), team('t2', 'B')]),
    );
    const result = await teamWorkload(ctx);
    expect(result).toMatchObject({
      status: 'needs_team_selection',
      teams: [{ name: 'A' }, { name: 'B' }],
    });
    expect(jiraCalls(/search\/jql/)).toHaveLength(0);
  });

  it('explains when the user has no team', async () => {
    onGraph('teamworkInsight_userTeams', connection('atlassianUserInTeams', []));
    const result = await teamWorkload(ctx);
    expect(result).toMatchObject({ status: 'no_team', teams: [] });
  });

  it('reports a Graph failure without inventing teams', async () => {
    onGraph('teamworkInsight_userTeams', { status: 403, body: {} });
    const result = await teamWorkload(ctx);
    expect(result.status).toBe('no_team');
    expect(result.sources[0]).toMatchObject({ source: 'teamworkGraph', status: 'error' });
  });

  it('supports a project-level view with unassigned counts', async () => {
    onJira(/search\/jql/, {
      body: {
        issues: [jiraIssue('MKT-1', { assignee: alice }), jiraIssue('MKT-2', { assignee: null })],
        isLast: true,
      },
    });
    const result = await teamWorkload(ctx, { projectKey: 'MKT' });
    expect(result).toMatchObject({
      status: 'ok',
      scope: { kind: 'project', project: { key: 'MKT' } },
      totals: { unassignedOpen: 1, open: 1 },
    });
  });

  it('returns NOT_FOUND for an empty or invisible project', async () => {
    onJira(/search\/jql/, { body: { issues: [], isLast: true } });
    await expect(teamWorkload(ctx, { projectKey: 'NOPE' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
