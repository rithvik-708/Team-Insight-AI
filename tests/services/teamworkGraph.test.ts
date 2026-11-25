jest.mock('@forge/api', () => require('../helpers/forgeMock').forgeApiMock);

import { connection, graphCalls, onGraph, registry, resetMocks } from '../helpers/forgeMock';
import { classifyGraphErrors, graphQuery } from '../../src/services/teamworkGraph/client';
import {
  getAssignedWorkItems,
  getWorkItemCommentAuthors,
  pingGraph,
} from '../../src/services/teamworkGraph/workItems';
import {
  getTeamMembers,
  getTeamsForProject,
  getUserTeams,
} from '../../src/services/teamworkGraph/teams';
import {
  ASSIGNED_WORK_ITEMS_QUERY,
  TEAM_MEMBERS_QUERY,
  USER_TEAMS_QUERY,
} from '../../src/services/teamworkGraph/queries';

beforeEach(resetMocks);

describe('query definitions', () => {
  it('use the documented curated query fields with inline fragments and pagination', () => {
    expect(ASSIGNED_WORK_ITEMS_QUERY).toContain(
      'atlassianUserAssignedJiraWorkItems(userId: $userId, first: $first, after: $after)',
    );
    expect(ASSIGNED_WORK_ITEMS_QUERY).toContain('... on JiraWorkItem');
    expect(USER_TEAMS_QUERY).toContain('atlassianUserInTeams(userId: $userId');
    expect(TEAM_MEMBERS_QUERY).toContain('atlassianTeamMembers(teamAri: $teamAri');
    for (const q of [ASSIGNED_WORK_ITEMS_QUERY, USER_TEAMS_QUERY, TEAM_MEMBERS_QUERY]) {
      expect(q).toContain('pageInfo');
      expect(q).toContain('hasNextPage');
      expect(q).toContain('endCursor');
    }
  });
});

describe('getAssignedWorkItems', () => {
  it('sends the user ARI, page size 25, and follows endCursor across pages', async () => {
    onGraph('teamworkInsight_assignedWorkItems', (vars) =>
      vars.after
        ? connection('atlassianUserAssignedJiraWorkItems', [
            {
              __typename: 'JiraWorkItem',
              key: 'MKT-3',
              summary: 'c',
              status: { name: 'Done', statusCategory: { key: 'done' } },
            },
          ])
        : connection(
            'atlassianUserAssignedJiraWorkItems',
            [
              {
                __typename: 'JiraWorkItem',
                key: 'MKT-1',
                summary: 'a',
                webUrl: 'https://x/browse/MKT-1',
                dueAt: '2020-01-01T00:00:00Z',
                status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
              },
              { __typename: 'ConfluencePage', id: 'p1' },
              null,
            ],
            true,
            'cursor-1',
          ),
    );

    const { items, hasMore } = await getAssignedWorkItems('acc-123');

    const calls = graphCalls('teamworkInsight_assignedWorkItems');
    expect(calls).toHaveLength(2);
    expect(calls[0].variables).toEqual({
      userId: 'ari:cloud:identity::user/acc-123',
      first: 25,
      after: null,
    });
    expect(calls[1].variables).toMatchObject({ after: 'cursor-1' });
    expect(hasMore).toBe(false);
    expect(items.map((i) => i.key)).toEqual(['MKT-1', 'MKT-3']);
    expect(items[0]).toMatchObject({
      status: 'In Progress',
      statusCategory: 'in_progress',
      isOverdue: true,
      url: 'https://x/browse/MKT-1',
      source: 'teamworkGraph',
    });
    expect(items[1].statusCategory).toBe('done');
  });

  it('stops at maxPages and reports hasMore', async () => {
    onGraph('teamworkInsight_assignedWorkItems', () =>
      connection(
        'atlassianUserAssignedJiraWorkItems',
        [{ __typename: 'JiraWorkItem', key: 'MKT-1' }],
        true,
        'next',
      ),
    );
    const { hasMore } = await getAssignedWorkItems('acc', 2);
    expect(graphCalls('teamworkInsight_assignedWorkItems')).toHaveLength(2);
    expect(hasMore).toBe(true);
  });

  it('handles empty and null connections', async () => {
    onGraph('teamworkInsight_assignedWorkItems', {
      body: { data: { atlassianUserAssignedJiraWorkItems: null } },
    });
    await expect(getAssignedWorkItems('acc')).resolves.toEqual({ items: [], hasMore: false });
  });
});

describe('teams', () => {
  it('parses teams and dedupes them', async () => {
    const team = {
      __typename: 'AtlassianTeam',
      id: 'ari:cloud:identity::team/t1',
      displayName: 'Web',
      profileUrl: 'https://home/t1',
    };
    onGraph(
      'teamworkInsight_userTeams',
      connection('atlassianUserInTeams', [team, team, { __typename: 'AtlassianTeam' }]),
    );
    const { teams } = await getUserTeams('acc');
    expect(teams).toEqual([
      {
        id: 'ari:cloud:identity::team/t1',
        name: 'Web',
        description: undefined,
        url: 'https://home/t1',
      },
    ]);
  });

  it('parses members and skips nodes without an accountId', async () => {
    onGraph(
      'teamworkInsight_teamMembers',
      connection('atlassianTeamMembers', [
        { __typename: 'AtlassianUser', accountId: 'a1', name: 'Alice' },
        { __typename: 'AtlassianUser', accountId: null, name: 'Ghost' },
        { __typename: 'AtlassianUser', accountId: 'a2', name: '' },
      ]),
    );
    const { members } = await getTeamMembers('ari:cloud:identity::team/t1');
    expect(graphCalls('teamworkInsight_teamMembers')[0].variables).toMatchObject({
      teamAri: 'ari:cloud:identity::team/t1',
    });
    expect(members).toEqual([
      { accountId: 'a1', displayName: 'Alice' },
      { accountId: 'a2', displayName: 'Unknown user' },
    ]);
  });

  it('builds the Jira project ARI for teams-by-space', async () => {
    onGraph('teamworkInsight_teamsBySpace', connection('atlassianTeamsBySpace', []));
    await getTeamsForProject('cloud-1', '10001');
    expect(graphCalls('teamworkInsight_teamsBySpace')[0].variables).toMatchObject({
      spaceAri: 'ari:cloud:jira:cloud-1:project/10001',
    });
  });
});

describe('comment authors', () => {
  it('aggregates by author and skips deleted comments', async () => {
    onGraph(
      'teamworkInsight_workItemComments',
      connection('jiraWorkItemComments', [
        {
          __typename: 'JiraWorkItemComment',
          author: { name: 'Bob' },
          createdAt: '2026-11-01T00:00:00Z',
        },
        {
          __typename: 'JiraWorkItemComment',
          author: { name: 'Bob' },
          createdAt: '2026-11-05T00:00:00Z',
        },
        { __typename: 'JiraWorkItemComment', author: { name: 'Carol' }, deleted: true },
      ]),
    );
    const authors = await getWorkItemCommentAuthors('cloud-1', '10021');
    expect(graphCalls('teamworkInsight_workItemComments')[0].variables).toMatchObject({
      id: 'ari:cloud:jira:cloud-1:issue/10021',
      since: 'P90D',
    });
    expect(authors).toEqual([
      { displayName: 'Bob', commentCount: 2, lastCommentAt: '2026-11-05T00:00:00Z' },
    ]);
  });
});

describe('error handling', () => {
  it('classifies unsupported fields, permission errors and generic errors', () => {
    expect(
      classifyGraphErrors([
        {
          message: "Validation error: Field 'x' in type 'Query' is undefined",
          extensions: { classification: 'ValidationError' },
        },
      ]).code,
    ).toBe('UNSUPPORTED');
    expect(classifyGraphErrors([{ message: 'Missing scope read:graph:team:atlassian' }]).code).toBe(
      'PERMISSION_DENIED',
    );
    expect(classifyGraphErrors([{ message: 'boom' }]).code).toBe('UPSTREAM_ERROR');
  });

  it('throws when data is null and maps HTTP errors', async () => {
    onGraph('op', { body: { data: null, errors: [{ message: 'Forbidden' }] } });
    await expect(graphQuery('op', 'query', {})).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
    onGraph('op2', { status: 429, body: {} });
    await expect(graphQuery('op2', 'query', {})).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    onGraph('op3', { status: 403, body: {} });
    await expect(graphQuery('op3', 'query', {})).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
  });

  it('keeps partial data when errors accompany data', async () => {
    onGraph('partial', { body: { data: { value: 1 }, errors: [{ message: 'one field failed' }] } });
    await expect(graphQuery('partial', 'query', {})).resolves.toEqual({ value: 1 });
  });

  it('pings with the documented echo query', async () => {
    onGraph('teamworkInsight_echo', (vars) => ({ body: { data: { echo: vars.value } } }));
    await expect(pingGraph()).resolves.toBe(true);
    expect(registry.calls[0].variables).toEqual({ value: 'teamwork-insight' });
  });
});
