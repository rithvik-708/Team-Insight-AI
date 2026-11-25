jest.mock('@forge/api', () => require('../helpers/forgeMock').forgeApiMock);

import { jiraCalls, jiraIssue, onJira, resetMocks } from '../helpers/forgeMock';
import { searchIssues, toWorkItem, getIssue } from '../../src/services/jira/issues';
import { getSiteUrl, resetSiteInfoCache } from '../../src/services/jira/client';
import { searchConfluencePages, searchTermsFromText } from '../../src/services/confluence/search';
import { onConfluence, registry } from '../helpers/forgeMock';

beforeEach(() => {
  resetMocks();
  resetSiteInfoCache();
});

describe('searchIssues', () => {
  it('uses the enhanced /search/jql endpoint with encoded JQL and follows nextPageToken', async () => {
    onJira(/search\/jql/, (url) =>
      url.includes('nextPageToken=tok')
        ? { body: { issues: [jiraIssue('MKT-2')], isLast: true } }
        : { body: { issues: [jiraIssue('MKT-1')], nextPageToken: 'tok', isLast: false } },
    );
    const { issues, truncated } = await searchIssues(
      'assignee = currentUser()',
      ['summary', 'status'],
      100,
    );
    const calls = jiraCalls(/search\/jql/);
    expect(calls).toHaveLength(2);
    expect(calls[0].target).toContain('/rest/api/3/search/jql?jql=assignee%20%3D%20currentUser()');
    expect(calls[0].target).toContain('fields=summary%2Cstatus');
    expect(issues.map((i) => i.key)).toEqual(['MKT-1', 'MKT-2']);
    expect(truncated).toBe(false);
    expect(jiraCalls(/\/rest\/api\/3\/search\?/)).toHaveLength(0);
  });

  it('stops at maxTotal and reports truncation', async () => {
    onJira(/search\/jql/, {
      body: { issues: [jiraIssue('MKT-1'), jiraIssue('MKT-2')], nextPageToken: 'more' },
    });
    const result = await searchIssues('x', ['summary'], 2);
    expect(result.truncated).toBe(true);
    expect(jiraCalls(/search\/jql/)).toHaveLength(1);
  });

  it('maps HTTP errors to AppErrors', async () => {
    onJira(/search\/jql/, { status: 400, body: { errorMessages: ['bad jql'] } });
    await expect(searchIssues('bad', ['summary'], 10)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    onJira(/issue\/MKT-404/, { status: 404 });
    await expect(getIssue('MKT-404', ['summary'])).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('toWorkItem', () => {
  it('normalises a Jira issue with a browse URL', () => {
    const item = toWorkItem(
      jiraIssue('MKT-21', {
        priority: 'High',
        category: 'indeterminate',
        status: 'In Progress',
        duedate: '2000-01-01',
      }),
      'https://example.atlassian.net/',
    );
    expect(item).toMatchObject({
      key: 'MKT-21',
      url: 'https://example.atlassian.net/browse/MKT-21',
      priority: 'High',
      statusCategory: 'in_progress',
      isOverdue: true,
      project: { key: 'MKT' },
      source: 'jira',
    });
  });
  it('tolerates missing fields', () => {
    expect(toWorkItem({ key: 'X-1' }, undefined)).toMatchObject({
      summary: '(no summary)',
      status: 'Unknown',
      statusCategory: 'unknown',
      url: undefined,
    });
    expect(toWorkItem({}, undefined)).toBeUndefined();
  });
});

describe('site info', () => {
  it('caches the site URL and does not cache failures', async () => {
    onJira(/serverInfo/, { status: 500 });
    await expect(getSiteUrl()).resolves.toBeUndefined();
    resetMocks();
    onJira(/serverInfo/, {
      body: { baseUrl: 'https://a.atlassian.net', displayUrl: 'https://custom.example.com' },
    });
    await expect(getSiteUrl()).resolves.toBe('https://custom.example.com');
    await getSiteUrl();
    expect(jiraCalls(/serverInfo/)).toHaveLength(1);
  });
});

describe('confluence search', () => {
  it('builds a CQL text query and absolute URLs with clean excerpts', async () => {
    onConfluence(/wiki\/rest\/api\/search/, {
      body: {
        _links: { base: 'https://example.atlassian.net/wiki' },
        results: [
          {
            content: { title: 'Landing page spec' },
            url: '/spaces/MKT/pages/1',
            excerpt: 'The @@@hl@@@landing@@@endhl@@@ page',
            resultGlobalContainer: { title: 'Marketing' },
          },
          { content: {}, url: '/x' },
        ],
      },
    });
    const docs = await searchConfluencePages('landing "page"');
    expect(docs).toEqual([
      expect.objectContaining({
        title: 'Landing page spec',
        url: 'https://example.atlassian.net/wiki/spaces/MKT/pages/1',
        excerpt: 'The landing page',
        space: 'Marketing',
        via: 'confluence_search',
      }),
    ]);
    const call = registry.calls.find((c) => c.kind === 'confluence');
    expect(decodeURIComponent(call!.target)).toContain(
      'cql=type = page AND text ~ "landing \\"page\\"" ORDER BY lastmodified DESC',
    );
  });

  it('derives search terms from an issue summary', () => {
    expect(searchTermsFromText('Implement the signup form for the landing page!')).toBe(
      'signup form landing page',
    );
  });

  it('reports failures as errors', async () => {
    onConfluence(/wiki/, { status: 403 });
    await expect(searchConfluencePages('x')).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
});
