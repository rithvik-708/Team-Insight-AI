/**
 * Test double for @forge/api. Jira/Confluence requests are matched against registered
 * (method, path-regex) handlers; Teamwork Graph requests are matched by operation name.
 * These are *mock* integration tests: they verify request construction and response handling,
 * not that live Atlassian APIs behave this way.
 */

export interface MockResponse {
  status?: number;
  body?: unknown;
}

type JiraHandler = (url: string, init?: { method?: string; body?: string }) => MockResponse;
type GraphHandler = (variables: Record<string, unknown>, query: string) => MockResponse;

interface Registry {
  jira: { pattern: RegExp; handler: JiraHandler }[];
  confluence: { pattern: RegExp; handler: JiraHandler }[];
  graph: Map<string, GraphHandler>;
  calls: {
    kind: 'jira' | 'confluence' | 'graph';
    target: string;
    variables?: Record<string, unknown>;
  }[];
}

export const registry: Registry = { jira: [], confluence: [], graph: new Map(), calls: [] };

export function resetMocks(): void {
  registry.jira = [];
  registry.confluence = [];
  registry.graph = new Map();
  registry.calls = [];
}

function toResponse({ status = 200, body }: MockResponse) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

export function onJira(pattern: RegExp, handler: JiraHandler | MockResponse): void {
  registry.jira.push({ pattern, handler: typeof handler === 'function' ? handler : () => handler });
}

export function onConfluence(pattern: RegExp, handler: JiraHandler | MockResponse): void {
  registry.confluence.push({
    pattern,
    handler: typeof handler === 'function' ? handler : () => handler,
  });
}

export function onGraph(operationName: string, handler: GraphHandler | MockResponse): void {
  registry.graph.set(operationName, typeof handler === 'function' ? handler : () => handler);
}

export function graphCalls(operationName: string) {
  return registry.calls.filter((c) => c.kind === 'graph' && c.target === operationName);
}

export function jiraCalls(pattern: RegExp) {
  return registry.calls.filter((c) => c.kind === 'jira' && pattern.test(c.target));
}

/** Mirrors Forge's `route` tagged template: interpolated values are URL-encoded. */
function route(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce(
    (acc, s, i) => acc + s + (i < values.length ? encodeURIComponent(String(values[i])) : ''),
    '',
  );
}

function dispatch(
  kind: 'jira' | 'confluence',
  url: string,
  init?: { method?: string; body?: string },
) {
  registry.calls.push({ kind, target: url });
  const handlers = kind === 'jira' ? registry.jira : registry.confluence;
  const match = handlers.find((h) => h.pattern.test(url));
  if (!match)
    return Promise.resolve(toResponse({ status: 404, body: { errorMessages: ['no mock'] } }));
  return Promise.resolve(toResponse(match.handler(url, init)));
}

export const forgeApiMock = {
  __esModule: true,
  route,
  default: {
    asUser: () => ({
      requestJira: (url: string, init?: { method?: string; body?: string }) =>
        dispatch('jira', url, init),
      requestConfluence: (url: string, init?: { method?: string; body?: string }) =>
        dispatch('confluence', url, init),
      requestTeamworkGraph: (
        query: string,
        variables: Record<string, unknown> = {},
        operationName = '',
      ) => {
        registry.calls.push({ kind: 'graph', target: operationName, variables });
        const handler = registry.graph.get(operationName);
        if (!handler)
          return Promise.resolve(
            toResponse({ body: { data: null, errors: [{ message: 'no mock' }] } }),
          );
        return Promise.resolve(toResponse(handler(variables, query)));
      },
    }),
  },
};

/** Builds a Relay connection body for a Graph curated query. */
export function connection(
  field: string,
  nodes: unknown[],
  hasNextPage = false,
  endCursor: string | null = null,
) {
  return {
    body: {
      data: {
        [field]: {
          edges: nodes.map((node) => ({ node })),
          pageInfo: { hasNextPage, endCursor },
        },
      },
    },
  };
}

export function jiraIssue(
  key: string,
  opts: {
    summary?: string;
    status?: string;
    category?: 'new' | 'indeterminate' | 'done';
    priority?: string;
    project?: string;
    assignee?: { accountId: string; displayName: string } | null;
    duedate?: string | null;
    updated?: string;
    extraFields?: Record<string, unknown>;
    id?: string;
  } = {},
) {
  return {
    id: opts.id ?? String(10000 + Number(key.split('-')[1])),
    key,
    fields: {
      summary: opts.summary ?? `Summary of ${key}`,
      status: { name: opts.status ?? 'To Do', statusCategory: { key: opts.category ?? 'new' } },
      priority: opts.priority ? { name: opts.priority } : null,
      issuetype: { name: 'Task' },
      project: { id: '10001', key: opts.project ?? key.split('-')[0], name: 'Marketing Site' },
      assignee: opts.assignee ?? null,
      duedate: opts.duedate ?? null,
      updated: opts.updated ?? '2026-11-01T10:00:00.000+0000',
      ...opts.extraFields,
    },
  };
}

export function graphWorkItem(key: string, statusName = 'In Progress', category = 'indeterminate') {
  return {
    __typename: 'JiraWorkItem',
    id: `ari:cloud:jira:site:issue/${key}`,
    key,
    summary: `Graph summary ${key}`,
    webUrl: `https://example.atlassian.net/browse/${key}`,
    dueAt: null,
    status: { name: statusName, statusCategory: { key: category } },
    issueType: { name: 'Task' },
  };
}

export const SERVER_INFO = {
  body: { baseUrl: 'https://example.atlassian.net', displayUrl: 'https://example.atlassian.net' },
};
