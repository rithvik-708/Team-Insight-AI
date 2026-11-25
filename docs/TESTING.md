# Testing

Testing is split into three levels. **Passing mock tests does not prove that the live Atlassian integrations work.** Live results are recorded separately in `IMPLEMENTATION-STATUS.md`.

## 1. Unit tests

These test pure logic with no I/O:

| File | Covers |
| --- | --- |
| `tests/utils/formatting.test.ts` | Status category mapping, priority ranking, overdue detection (timezone-safe), sort order, chunking |
| `tests/utils/validation.test.ts` | Issue, project and team key parsing (including URLs and lowercase), loose Rovo inputs, JQL escaping, error mapping, no leakage of internal messages |
| `tests/assistant/router.test.ts` | Question → action routing, issue, project and team extraction, unknown inputs |
| Parts of `tests/actions/*` | `aggregateWorkload` (counts, load flags, members without work), `selectTeam` (never picks the first of several), `suggestFocus`, `mergeCommenters`, `suggestContacts` |

## 2. Mock integration tests

`tests/helpers/forgeMock.ts` replaces `@forge/api`. Jira and Confluence requests are matched by URL pattern, and Teamwork Graph requests by operation name. The `route` mock URL-encodes like the real one. These tests check:

- **GraphQL construction:** operation names, user, team, issue and project ARIs, `first: 25`, `after` cursors, page limits (`tests/services/teamworkGraph.test.ts`)
- **Graph parsing:** union `__typename` filtering, null connections, dedupe, partial-data handling, error classification (unsupported field, permission, rate limit)
- **Jira requests:** `/search/jql` (never the deprecated `/search`), JQL encoding, `nextPageToken` pagination, caps, HTTP error mapping, site URL caching (`tests/services/jira.test.ts`)
- **Confluence:** CQL construction and escaping, absolute URLs, excerpt cleanup, 403 handling
- **Actions end to end over mocks:**
  - Graph + Jira merge
  - Stale-graph-item removal
  - Fallback when the Graph fails
  - Both sources failing
  - Team selection, no team, Graph failure
  - Project view
  - Issue people with degraded sources
  - Blocker direction, stale blockers
  - Docs when Confluence is unavailable
- **Handlers:** identity only from `principal`, cloudId from `installContext`, string inputs coerced, errors returned as envelopes, issue key from the Rovo context, team id in the name field

Run:

```bash
npm test
npm run test:coverage   # ~95% lines at the time of writing
```

## 3. Live integration tests (manual, on a real site)

**Prerequisites:**
- The app is deployed and installed by an org admin.
- Rovo is enabled.
- The demo dataset from `docs/DEMO.md` exists.
- A second test user with restricted project access.

Run `forge logs -e development --since 15m` alongside and work through the *Live verification checklist* in `IMPLEMENTATION-STATUS.md`. For Teamwork Graph schema questions, use the GraphiQL playground linked from the Teamwork Graph docs, or `GET https://<site>.atlassian.net/gateway/api/graphql/twg/schema`.

Specific things to confirm live:

1. **Graph connectivity:** the dashboard header shows *Teamwork Graph: Connected*. If not, check the org-admin install and scopes.
2. **`jiraWorkItemComments` author selection:** `author { name }`. If the schema rejects it, the action reports Graph comments as `error` and still returns Jira commenters. Adjust the query in `queries.ts`.
3. **Permission boundaries:** as the restricted user, `get-issue-people` on a hidden issue must return `NOT_FOUND`, and team workload must not list issues from hidden projects.
4. **Rovo grounding:** each conversation starter triggers the expected action (visible in `forge logs` as `action.ok`), and answers cite keys with links.
5. **MCP:** add the tools to a Rovo Studio agent; optionally connect an external client after admin enablement.
