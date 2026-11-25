import { AppError } from '../utils/errors';
import type { RequestContext, RovoActionPayload } from '../types/actions';

/** installContext looks like `ari:cloud:jira::site/{cloudId}`. */
export function cloudIdFromInstallContext(installContext: string | undefined): string | undefined {
  const match = installContext?.match(/:site\/([0-9a-f-]{36})$/i);
  return match?.[1];
}

interface ForgeFunctionContext {
  installContext?: string;
  principal?: { accountId?: string };
}

/**
 * Builds the RequestContext for a Rovo action / MCP tool invocation.
 * Identity comes only from the Forge function context (`principal.accountId`); never from inputs.
 */
export function contextFromRovo(
  payload: RovoActionPayload,
  context: ForgeFunctionContext,
): RequestContext {
  const accountId = context?.principal?.accountId;
  if (!accountId) {
    throw new AppError(
      'AUTH_REQUIRED',
      'Teamwork Insight could not identify the signed-in user for this request.',
    );
  }
  const jira = payload?.context?.jira;
  return {
    accountId,
    cloudId: payload?.context?.cloudId ?? cloudIdFromInstallContext(context.installContext),
    contextIssueKey: jira?.issueKey !== undefined ? String(jira.issueKey) : undefined,
    contextProjectKey: jira?.projectKey !== undefined ? String(jira.projectKey) : undefined,
  };
}

interface ResolverRequestContext {
  accountId?: string;
  cloudId?: string;
  installContext?: string;
  extension?: { issue?: { key?: string }; project?: { key?: string } };
}

/** Builds the RequestContext for a Custom UI resolver call. */
export function contextFromResolver(context: ResolverRequestContext): RequestContext {
  if (!context?.accountId) {
    throw new AppError('AUTH_REQUIRED', 'Teamwork Insight could not identify the signed-in user.');
  }
  return {
    accountId: context.accountId,
    cloudId: context.cloudId ?? cloudIdFromInstallContext(context.installContext),
    contextIssueKey: context.extension?.issue?.key,
    contextProjectKey: context.extension?.project?.key,
  };
}
