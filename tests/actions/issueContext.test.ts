jest.mock('@forge/api', () => require('../helpers/forgeMock').forgeApiMock);

import {
  SERVER_INFO,
  connection,
  graphCalls,
  jiraIssue,
  onConfluence,
  onGraph,
  onJira,
  resetMocks,
} from '../helpers/forgeMock';
import { issuePeople, mergeCommenters, suggestContacts } from '../../src/actions/issuePeople';
import { relatedWork } from '../../src/actions/relatedWork';
import { blockedWork } from '../../src/actions/blockedWork';
import { relatedDocs } from '../../src/actions/relatedDocs';
import { resetSiteInfoCache } from '../../src/services/jira/client';

const alice = { accountId: 'a1', displayName: 'Alice' };
const bob = { accountId: 'b2', displayName: 'Bob' };
const carol = { accountId: 'c3', displayName: 'Carol' };

const blocksType = { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' };
const relatesType = { name: 'Relates', inward: 'relates to', outward: 'relates to' };
const linked = (key: string, category: 'new' | 'indeterminate' | 'done' = 'new') => ({
  key,
  fields: {
    summary: `S ${key}`,
    status: { name: category === 'done' ? 'Done' : 'To Do', statusCategory: { key: category } },
  },
});

const detailedIssue = jiraIssue('MKT-21', {
  assignee: alice,
  id: '10021',
  extraFields: {
    reporter: bob,
    creator: bob,
    issuelinks: [
      { type: blocksType, inwardIssue: linked('MKT-30') },
      { type: blocksType, outwardIssue: linked('MKT-40') },
      { type: relatesType, outwardIssue: linked('MKT-50') },
    ],
    parent: linked('MKT-1', 'indeterminate'),
    subtasks: [linked('MKT-22')],
  },
});

beforeEach(() => {
  resetMocks();
  resetSiteInfoCache();
  onJira(/serverInfo/, SERVER_INFO);
});

describe('issuePeople', () => {
  it('combines Jira ownership, comments, watchers and Graph teams', async () => {
    onJira(/issue\/MKT-21\/comment/, {
      body: {
        total: 3,
        comments: [
          { author: carol, created: '2026-11-02' },
          { author: carol, created: '2026-11-03' },
          { author: bob, created: '2026-11-01' },
        ],
      },
    });
    onJira(/issue\/MKT-21\/watchers/, { body: { watchCount: 2, watchers: [alice, carol] } });
    onJira(/issue\/MKT-21\?/, { body: detailedIssue });
    onGraph(
      'teamworkInsight_workItemComments',
      connection('jiraWorkItemComments', [
        { __typename: 'JiraWorkItemComment', author: { name: 'Dave' }, createdAt: '2026-10-01' },
      ]),
    );
    onGraph(
      'teamworkInsight_teamsBySpace',
      connection('atlassianTeamsBySpace', [
        {
          __typename: 'AtlassianTeam',
          id: 'ari:cloud:identity::team/t1',
          displayName: 'Marketing Squad',
        },
      ]),
    );

    const result = await issuePeople({ accountId: 'me', cloudId: 'cloud-1' }, 'MKT-21');

    expect(result.issue).toMatchObject({
      key: 'MKT-21',
      url: 'https://example.atlassian.net/browse/MKT-21',
    });
    expect(result.assignee).toEqual(alice);
    expect(result.reporter).toEqual(bob);
    expect(result.creator).toBeUndefined();
    expect(result.commenters.map((c) => [c.displayName, c.commentCount])).toEqual([
      ['Carol', 2],
      ['Bob', 1],
      ['Dave', 1],
    ]);
    expect(result.watchers).toMatchObject({ status: 'ok', count: 2 });
    expect(result.teams).toEqual([expect.objectContaining({ name: 'Marketing Squad' })]);
    expect(result.linkedIssueCount).toBe(5);
    expect(result.suggestedContacts[0]).toMatchObject({
      displayName: 'Alice',
      reason: expect.stringMatching(/Assignee/),
    });
    expect(result.suggestedContacts.find((c) => c.displayName === 'Carol')?.reason).toMatch(
      /not necessarily responsible/,
    );
    expect(graphCalls('teamworkInsight_workItemComments')[0].variables).toMatchObject({
      id: 'ari:cloud:jira:cloud-1:issue/10021',
    });
  });

  it('degrades gracefully when watchers, comments and Graph are unavailable', async () => {
    onJira(/issue\/MKT-21\/comment/, { status: 500 });
    onJira(/issue\/MKT-21\/watchers/, { status: 403 });
    onJira(/issue\/MKT-21\?/, { body: detailedIssue });
    const result = await issuePeople({ accountId: 'me' }, 'MKT-21');
    expect(result.watchers.status).toBe('unavailable');
    expect(result.commenters).toEqual([]);
    expect(result.notes.join(' ')).toMatch(/skipped/);
    expect(result.sources).toEqual(
      expect.arrayContaining([expect.objectContaining({ purpose: 'comments', status: 'error' })]),
    );
  });

  it('surfaces NOT_FOUND for an issue the user cannot see', async () => {
    onJira(/issue\/MKT-99/, { status: 404 });
    await expect(issuePeople({ accountId: 'me' }, 'MKT-99')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('merges Jira and Graph commenters by name', () => {
    const merged = mergeCommenters(
      [{ author: alice, created: '2026-01-01' }],
      [
        { displayName: 'alice', commentCount: 4 },
        { displayName: 'Zed', commentCount: 1 },
      ],
    );
    expect(merged.map((m) => m.displayName)).toEqual(['Alice', 'Zed']);
  });

  it('does not list the same person twice in contacts', () => {
    const contacts = suggestContacts(alice, alice, [{ ...alice, commentCount: 3 }]);
    expect(contacts).toHaveLength(1);
  });
});

describe('relatedWork', () => {
  it('reports parent, children, blockers and links with correct direction', async () => {
    onJira(/issue\/MKT-21\?/, { body: detailedIssue });
    onJira(/search\/jql/, {
      body: {
        issues: [jiraIssue('MKT-23', { assignee: carol }), jiraIssue('MKT-22')],
        isLast: true,
      },
    });
    onJira(/remotelink/, {
      body: [
        {
          object: { title: 'Spec', url: 'https://example.atlassian.net/wiki/x' },
          application: { name: 'Confluence' },
        },
        { object: { url: 'javascript:alert(1)' } },
      ],
    });

    const result = await relatedWork('MKT-21');

    expect(result.parent).toMatchObject({ key: 'MKT-1', relationship: 'parent' });
    expect(result.children.map((c) => c.key)).toEqual(['MKT-22', 'MKT-23']);
    expect(result.blockedBy.map((b) => b.key)).toEqual(['MKT-30']);
    expect(result.blocks.map((b) => b.key)).toEqual(['MKT-40']);
    expect(result.links.find((l) => l.key === 'MKT-50')?.relationship).toBe('relates to');
    expect(result.isBlocked).toBe(true);
    expect(result.remoteLinks).toEqual([
      { title: 'Spec', url: 'https://example.atlassian.net/wiki/x', application: 'Confluence' },
    ]);
  });

  it('is not blocked when every blocker is done', async () => {
    const issue = jiraIssue('MKT-60', {
      extraFields: { issuelinks: [{ type: blocksType, inwardIssue: linked('MKT-61', 'done') }] },
    });
    onJira(/issue\/MKT-60\?/, { body: issue });
    onJira(/search\/jql/, { body: { issues: [], isLast: true } });
    onJira(/remotelink/, { body: [] });
    const result = await relatedWork('MKT-60');
    expect(result.blockedBy).toHaveLength(1);
    expect(result.isBlocked).toBe(false);
  });
});

describe('blockedWork', () => {
  it('finds blocked issues and flags stale blocker links', async () => {
    onJira(/search\/jql/, {
      body: {
        issues: [
          jiraIssue('MKT-1', {
            extraFields: {
              issuelinks: [{ type: blocksType, inwardIssue: linked('MKT-9', 'done') }],
            },
          }),
          jiraIssue('MKT-2', {
            priority: 'Low',
            extraFields: { issuelinks: [{ type: blocksType, inwardIssue: linked('MKT-8') }] },
          }),
          jiraIssue('MKT-3', {
            extraFields: { issuelinks: [{ type: blocksType, outwardIssue: linked('MKT-7') }] },
          }),
        ],
        isLast: true,
      },
    });
    const result = await blockedWork('MKT');
    expect(result.items.map((i) => [i.key, i.allBlockersResolved])).toEqual([
      ['MKT-2', false],
      ['MKT-1', true],
    ]);
    expect(result.notes.join(' ')).toMatch(/outdated/);
    expect(result.scope).toEqual({ kind: 'project', projectKey: 'MKT' });
  });
});

describe('relatedDocs', () => {
  it('returns linked documents and Confluence matches, labelled by origin', async () => {
    onJira(/issue\/MKT-21\/remotelink/, {
      body: [
        {
          object: {
            title: 'Launch plan',
            url: 'https://example.atlassian.net/wiki/spaces/MKT/pages/9',
          },
        },
      ],
    });
    onJira(/issue\/MKT-21\?/, { body: jiraIssue('MKT-21', { summary: 'Design landing page' }) });
    onConfluence(/search/, {
      body: {
        _links: { base: 'https://example.atlassian.net/wiki' },
        results: [
          { content: { title: 'Launch plan' }, url: '/spaces/MKT/pages/9' },
          { content: { title: 'Landing page guidelines' }, url: '/spaces/MKT/pages/10' },
        ],
      },
    });
    const result = await relatedDocs({ issueKey: 'MKT-21' });
    expect(result.query).toBe('design landing page');
    expect(result.documents.map((d) => [d.title, d.via])).toEqual([
      ['Launch plan', 'jira_remote_link'],
      ['Landing page guidelines', 'confluence_search'],
    ]);
  });

  it('still returns linked docs when Confluence is unavailable', async () => {
    onJira(/remotelink/, {
      body: [{ object: { title: 'Doc', url: 'https://docs.example.com/a' } }],
    });
    onJira(/issue\/MKT-21\?/, { body: jiraIssue('MKT-21') });
    onConfluence(/search/, { status: 404 });
    const result = await relatedDocs({ issueKey: 'MKT-21' });
    expect(result.documents).toHaveLength(1);
    expect(result.sources.find((s) => s.source === 'confluence')).toMatchObject({
      status: 'unavailable',
    });
  });

  it('requires an issue or a query', async () => {
    await expect(relatedDocs({})).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
