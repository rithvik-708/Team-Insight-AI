import { myWorkSummary } from '../actions/myWorkSummary';
import { teamWorkload } from '../actions/teamWorkload';
import { issuePeople } from '../actions/issuePeople';
import { relatedWork } from '../actions/relatedWork';
import { blockedWork } from '../actions/blockedWork';
import { relatedDocs } from '../actions/relatedDocs';
import { AppError, toErrorPayload, type ErrorPayload } from '../utils/errors';
import { log } from '../utils/logging';
import {
  parseIssueKey,
  parseOptionalBoolean,
  parseOptionalInt,
  parseOptionalIssueKey,
  parseOptionalProjectKey,
  parseOptionalTeamAri,
  parseOptionalText,
} from '../utils/validation';
import { contextFromRovo } from './context';
import type { RequestContext, RovoActionPayload } from '../types/actions';

/**
 * Rovo action + MCP tool handlers. Each is a thin adapter: validate inputs, resolve the issue key
 * from inputs or the surrounding Jira context, call one business action, return structured JSON.
 * Errors are returned (not thrown) as `{ ok: false, error }` so the agent can explain them.
 */

type ForgeContext = Parameters<typeof contextFromRovo>[1];
type Result<T> = { ok: true; result: T } | ErrorPayload;

async function run<T>(
  action: string,
  payload: RovoActionPayload,
  context: ForgeContext,
  fn: (ctx: RequestContext) => Promise<T>,
): Promise<Result<T>> {
  const started = Date.now();
  try {
    const ctx = contextFromRovo(payload ?? {}, context);
    const result = await fn(ctx);
    log.info('action.ok', { action, ms: Date.now() - started });
    return { ok: true, result };
  } catch (err) {
    const payloadErr = toErrorPayload(err);
    log.warn('action.failed', { action, ms: Date.now() - started, code: payloadErr.error.code });
    return payloadErr;
  }
}

/** Explicit input wins; otherwise fall back to the issue the user is viewing. */
function resolveIssueKey(payload: RovoActionPayload, ctx: RequestContext): string {
  const explicit = parseOptionalIssueKey(payload.issueKey);
  if (explicit) return explicit;
  if (ctx.contextIssueKey) return parseIssueKey(ctx.contextIssueKey);
  throw new AppError(
    'INVALID_INPUT',
    'Which issue do you mean? Please provide an issue key such as MKT-21.',
  );
}

export const myWorkSummaryAction = (payload: RovoActionPayload, context: ForgeContext) =>
  run('myWorkSummary', payload, context, (ctx) =>
    myWorkSummary(ctx, {
      includeDone: parseOptionalBoolean(payload.includeDone, false),
      limit: parseOptionalInt(payload.limit, { min: 1, max: 25, fallback: 10 }),
      projectKey: parseOptionalProjectKey(payload.projectKey),
    }),
  );

export const teamWorkloadAction = (payload: RovoActionPayload, context: ForgeContext) =>
  run('teamWorkload', payload, context, (ctx) => {
    const teamName = parseOptionalText(payload.teamName, 100);
    // An LLM may pass a team id in the name field; accept it if it is a valid team ARI/UUID.
    const teamId = parseOptionalTeamAri(payload.teamId) ?? parseOptionalTeamAri(teamName);
    return teamWorkload(ctx, {
      teamId,
      teamName: teamId ? undefined : teamName,
      projectKey: parseOptionalProjectKey(payload.projectKey),
    });
  });

export const issuePeopleAction = (payload: RovoActionPayload, context: ForgeContext) =>
  run('issuePeople', payload, context, (ctx) => issuePeople(ctx, resolveIssueKey(payload, ctx)));

export const relatedWorkAction = (payload: RovoActionPayload, context: ForgeContext) =>
  run('relatedWork', payload, context, (ctx) => relatedWork(resolveIssueKey(payload, ctx)));

export const blockedWorkAction = (payload: RovoActionPayload, context: ForgeContext) =>
  run('blockedWork', payload, context, async () =>
    blockedWork(parseOptionalProjectKey(payload.projectKey)),
  );

export const relatedDocsAction = (payload: RovoActionPayload, context: ForgeContext) =>
  run('relatedDocs', payload, context, (ctx) => {
    const query = parseOptionalText(payload.query, 120);
    const explicitKey = parseOptionalIssueKey(payload.issueKey);
    const issueKey = explicitKey ?? (query ? undefined : ctx.contextIssueKey);
    return relatedDocs({ issueKey: issueKey ? parseIssueKey(issueKey) : undefined, query });
  });
