import Resolver from '@forge/resolver';
import { myWorkSummary } from '../actions/myWorkSummary';
import { teamWorkload } from '../actions/teamWorkload';
import { issuePeople } from '../actions/issuePeople';
import { relatedWork } from '../actions/relatedWork';
import { blockedWork } from '../actions/blockedWork';
import { relatedDocs } from '../actions/relatedDocs';
import { routeQuestion } from '../assistant/router';
import { getUserTeams } from '../services/teamworkGraph/teams';
import { pingGraph } from '../services/teamworkGraph/workItems';
import { getSiteUrl } from '../services/jira/client';
import { AppError, describeFailure, toErrorPayload } from '../utils/errors';
import { log } from '../utils/logging';
import {
  parseIssueKey,
  parseOptionalIssueKey,
  parseOptionalProjectKey,
  parseOptionalTeamAri,
  parseOptionalText,
} from '../utils/validation';
import { contextFromResolver } from './context';
import type { RequestContext } from '../types/actions';

/**
 * Custom UI resolver for the Teamwork Insight dashboard. Every function returns
 * `{ ok: true, data }` or `{ ok: false, error }` so the UI can render precise error states.
 */
const resolver = new Resolver();

type Payload = Record<string, unknown>;

function define(
  name: string,
  fn: (ctx: RequestContext, payload: Payload) => Promise<unknown>,
): void {
  resolver.define(name, async (req) => {
    const started = Date.now();
    try {
      const ctx = contextFromResolver(req.context as Parameters<typeof contextFromResolver>[0]);
      const data = await fn(ctx, (req.payload ?? {}) as Payload);
      log.info('resolver.ok', { fn: name, ms: Date.now() - started });
      return { ok: true, data };
    } catch (err) {
      const payload = toErrorPayload(err);
      log.warn('resolver.failed', { fn: name, ms: Date.now() - started, code: payload.error.code });
      return payload;
    }
  });
}

/** Integration status for the header: is Teamwork Graph reachable for this user? */
define('getStatus', async () => {
  const [graph, siteUrl] = await Promise.all([
    pingGraph().then(
      (ok) => ({ status: ok ? 'connected' : 'degraded' }),
      (err: unknown) => ({ status: 'unavailable', detail: describeFailure(err) }),
    ),
    getSiteUrl(),
  ]);
  return { teamworkGraph: graph, siteUrl };
});

define('getMyWork', (ctx, p) =>
  myWorkSummary(ctx, { limit: 25, projectKey: parseOptionalProjectKey(p.projectKey) }),
);

define('getMyTeams', async (ctx) => getUserTeams(ctx.accountId));

define('getTeamWorkload', (ctx, p) =>
  teamWorkload(ctx, {
    teamId: parseOptionalTeamAri(p.teamId),
    projectKey: parseOptionalProjectKey(p.projectKey),
  }),
);

define('getIssueContext', async (ctx, p) => {
  const issueKey = parseIssueKey(p.issueKey);
  const [people, related] = await Promise.all([issuePeople(ctx, issueKey), relatedWork(issueKey)]);
  return { people, related };
});

define('getBlockedWork', (_ctx, p) => blockedWork(parseOptionalProjectKey(p.projectKey)));

define('getRelatedDocs', (_ctx, p) =>
  relatedDocs({
    issueKey: parseOptionalIssueKey(p.issueKey),
    query: parseOptionalText(p.query, 120),
  }),
);

/** Quick-ask: routes a question to one action and returns which action answered. */
define('ask', async (ctx, p) => {
  const question = parseOptionalText(p.question, 300);
  if (!question) throw new AppError('INVALID_INPUT', 'Type a question first.');
  const route = routeQuestion(question, ctx.contextIssueKey);
  switch (route.intent) {
    case 'myWork':
      return {
        intent: route.intent,
        result: await myWorkSummary(ctx, { projectKey: route.projectKey }),
      };
    case 'focus':
      return { intent: route.intent, result: await myWorkSummary(ctx, {}) };
    case 'teamWorkload':
      return {
        intent: route.intent,
        result: await teamWorkload(ctx, { teamName: route.teamName, projectKey: route.projectKey }),
      };
    case 'issuePeople':
      return {
        intent: route.intent,
        result: await issuePeople(ctx, parseIssueKey(route.issueKey)),
      };
    case 'relatedWork':
      return { intent: route.intent, result: await relatedWork(parseIssueKey(route.issueKey)) };
    case 'relatedDocs':
      return {
        intent: route.intent,
        result: await relatedDocs({
          issueKey: route.issueKey ? parseIssueKey(route.issueKey) : undefined,
          query: route.query,
        }),
      };
    case 'blockedWork':
      return { intent: route.intent, result: await blockedWork(route.projectKey) };
    case 'needsIssue':
      return { intent: route.intent, asked: route.asked };
    default:
      return { intent: 'unknown' };
  }
});

export const handler = resolver.getDefinitions();
