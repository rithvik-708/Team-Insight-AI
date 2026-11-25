jest.mock('@forge/api', () => require('../helpers/forgeMock').forgeApiMock);

import {
  SERVER_INFO,
  connection,
  jiraIssue,
  onGraph,
  onJira,
  resetMocks,
} from '../helpers/forgeMock';
import {
  issuePeopleAction,
  myWorkSummaryAction,
  relatedDocsAction,
  teamWorkloadAction,
} from '../../src/handlers/rovoActions';
import {
  cloudIdFromInstallContext,
  contextFromResolver,
  contextFromRovo,
} from '../../src/handlers/context';
import { resetSiteInfoCache } from '../../src/services/jira/client';

const forgeContext = {
  principal: { accountId: 'me-1' },
  installContext: 'ari:cloud:jira::site/7607d59e-650b-4c16-adcf-c19d17c915ac',
};

beforeEach(() => {
  resetMocks();
  resetSiteInfoCache();
  onJira(/serverInfo/, SERVER_INFO);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('context extraction', () => {
  it('reads identity from principal and the cloud id from the install context', () => {
    expect(contextFromRovo({}, forgeContext)).toEqual({
      accountId: 'me-1',
      cloudId: '7607d59e-650b-4c16-adcf-c19d17c915ac',
      contextIssueKey: undefined,
      contextProjectKey: undefined,
    });
  });
  it('prefers the payload context cloud id and stringifies the context issue key', () => {
    const ctx = contextFromRovo(
      { context: { cloudId: 'other', jira: { issueKey: 'MKT-2', projectKey: 'MKT' } } },
      forgeContext,
    );
    expect(ctx).toMatchObject({
      cloudId: 'other',
      contextIssueKey: 'MKT-2',
      contextProjectKey: 'MKT',
    });
  });
  it('ignores identity-like values passed as inputs', () => {
    expect(contextFromRovo({ accountId: 'attacker' }, forgeContext).accountId).toBe('me-1');
  });
  it('rejects calls without a principal', () => {
    expect(() => contextFromRovo({}, {})).toThrow(
      expect.objectContaining({ code: 'AUTH_REQUIRED' }),
    );
    expect(() => contextFromResolver({})).toThrow(
      expect.objectContaining({ code: 'AUTH_REQUIRED' }),
    );
  });
  it('parses install context ARIs', () => {
    expect(
      cloudIdFromInstallContext('ari:cloud:jira::site/7607d59e-650b-4c16-adcf-c19d17c915ac'),
    ).toBe('7607d59e-650b-4c16-adcf-c19d17c915ac');
    expect(cloudIdFromInstallContext('garbage')).toBeUndefined();
  });
});

describe('Rovo action handlers', () => {
  it('returns { ok: true, result } and coerces string inputs from Rovo', async () => {
    onJira(/myself/, { body: { accountId: 'me-1', displayName: 'Me' } });
    onGraph(
      'teamworkInsight_assignedWorkItems',
      connection('atlassianUserAssignedJiraWorkItems', []),
    );
    onJira(/search\/jql/, {
      body: { issues: [jiraIssue('MKT-1'), jiraIssue('MKT-2'), jiraIssue('MKT-3')], isLast: true },
    });
    const res = await myWorkSummaryAction({ limit: '2', includeDone: 'false' }, forgeContext);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.result.items).toHaveLength(2);
  });

  it('returns a structured error instead of throwing for invalid input', async () => {
    const res = await issuePeopleAction({ issueKey: 'not a key' }, forgeContext);
    expect(res).toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: expect.stringContaining('not a valid Jira issue key'),
      },
    });
  });

  it('asks for an issue when none is given or in context', async () => {
    const res = await issuePeopleAction({}, forgeContext);
    expect(res).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT', message: expect.stringMatching(/Which issue/) },
    });
  });

  it('falls back to the issue in the Rovo context', async () => {
    onJira(/issue\/MKT-5\?/, { body: jiraIssue('MKT-5') });
    onJira(/comment/, { body: { comments: [] } });
    onJira(/watchers/, { body: { watchCount: 0, watchers: [] } });
    const res = await issuePeopleAction({ context: { jira: { issueKey: 'MKT-5' } } }, forgeContext);
    expect(res).toMatchObject({ ok: true, result: { issue: { key: 'MKT-5' } } });
  });

  it('accepts a team id passed in the teamName field', async () => {
    const uuid = '19441f6d-f53e-4e35-a89f-265a30db4e68';
    onGraph('teamworkInsight_userTeams', connection('atlassianUserInTeams', []));
    onGraph('teamworkInsight_teamMembers', connection('atlassianTeamMembers', []));
    const res = await teamWorkloadAction({ teamName: uuid }, forgeContext);
    expect(res).toMatchObject({
      ok: true,
      result: { status: 'ok', scope: { team: { id: `ari:cloud:identity::team/${uuid}` } } },
    });
  });

  it('prefers an explicit query over the context issue for docs', async () => {
    onJira(/remotelink/, { body: [] });
    const res = await relatedDocsAction(
      { query: 'onboarding', context: { jira: { issueKey: 'MKT-5' } } },
      forgeContext,
    );
    expect(res).toMatchObject({ ok: true, result: { query: 'onboarding', issue: undefined } });
  });
});
