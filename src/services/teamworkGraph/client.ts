import api from '@forge/api';
import { AppError, toAppError } from '../../utils/errors';
import { log } from '../../utils/logging';
import { withTimeout } from '../http';
import type { Connection, GraphError, GraphResponse } from '../../types/teamworkGraph';
import { GRAPH_PAGE_SIZE } from './queries';

/**
 * Executes a Teamwork Graph query as the invoking user via the documented Forge API:
 *   api.asUser().requestTeamworkGraph(query, variables, operationName)
 * Results are permission-filtered for that user by Atlassian.
 */
export async function graphQuery<T>(
  operationName: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  let body: GraphResponse<T>;
  try {
    const response = await withTimeout(
      api.asUser().requestTeamworkGraph(query, variables, operationName),
      'Teamwork Graph',
    );
    if (!response.ok) {
      throw graphHttpError(response.status);
    }
    body = (await response.json()) as GraphResponse<T>;
  } catch (err) {
    throw toAppError(err);
  }

  const errors = body?.errors ?? [];
  if (errors.length > 0) {
    log.warn('teamworkGraph.errors', {
      operation: operationName,
      count: errors.length,
      classification: String(errors[0]?.extensions?.classification ?? 'unknown'),
    });
  }
  if (body?.data == null) {
    throw classifyGraphErrors(errors);
  }
  // Partial data with errors: keep the data (GraphQL semantics); the warning is logged above.
  return body.data;
}

function graphHttpError(status: number): AppError {
  if (status === 401) return new AppError('AUTH_REQUIRED', undefined, { status });
  if (status === 403) {
    return new AppError(
      'PERMISSION_DENIED',
      'Teamwork Graph access was denied. An organization admin must install the app and the Teamwork Graph scopes must be granted.',
      { status },
    );
  }
  if (status === 429) return new AppError('RATE_LIMITED', undefined, { status });
  return new AppError('UPSTREAM_ERROR', `Teamwork Graph returned HTTP ${status}.`, { status });
}

/** Maps GraphQL error payloads to AppErrors without leaking raw upstream messages to users. */
export function classifyGraphErrors(errors: GraphError[]): AppError {
  const text = errors
    .map(
      (e) =>
        `${e.message ?? ''} ${e.extensions?.classification ?? ''} ${e.extensions?.errorType ?? ''}`,
    )
    .join(' ');
  if (/FieldUndefined|Cannot query field|ValidationError|Unknown (field|argument)/i.test(text)) {
    return new AppError(
      'UNSUPPORTED',
      'This Teamwork Graph query is not available on this site (the curated query or field may have changed).',
    );
  }
  if (/scope|forbidden|permission|unauthori[sz]ed/i.test(text)) {
    return new AppError(
      'PERMISSION_DENIED',
      'Teamwork Graph denied this request. Check that the app was installed by an org admin and its Teamwork Graph scopes are granted.',
    );
  }
  if (/rate.?limit|too many/i.test(text)) return new AppError('RATE_LIMITED');
  return new AppError('UPSTREAM_ERROR', 'Teamwork Graph returned an error for this request.');
}

/**
 * Walks a curated-query connection page by page (25 per page, the documented maximum).
 * `select` picks the connection out of the response data.
 */
export async function paginateConnection<N>(
  operationName: string,
  query: string,
  variables: Record<string, unknown>,
  select: (data: Record<string, unknown>) => Connection<N> | null | undefined,
  maxPages: number,
): Promise<{ nodes: N[]; hasMore: boolean }> {
  const nodes: N[] = [];
  let after: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const data = await graphQuery<Record<string, unknown>>(operationName, query, {
      ...variables,
      first: GRAPH_PAGE_SIZE,
      after: after ?? null,
    });
    const connection = select(data);
    for (const edge of connection?.edges ?? []) {
      if (edge?.node) nodes.push(edge.node);
    }
    const pageInfo = connection?.pageInfo;
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) return { nodes, hasMore: false };
    after = pageInfo.endCursor;
  }
  return { nodes, hasMore: true };
}
