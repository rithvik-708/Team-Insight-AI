# API integration

Every API below was checked against official Atlassian documentation on 2026-11-15 (see the *Verification log* at the end). All calls run with `api.asUser()`.

## Permission scopes

| Scope | Used by | Why |
| --- | --- | --- |
| `read:jira-work` | Jira REST | `search/jql`, issue, comments, watchers, remote links, `serverInfo` |
| `read:jira-user` | Jira REST | `/rest/api/3/myself` |
| `search:confluence` | Confluence REST | `GET /wiki/rest/api/search` (CQL) |
| `read:graph:user:atlassian` | Teamwork Graph | AtlassianUser: query start node and team members |
| `read:graph:team:atlassian` | Teamwork Graph | AtlassianTeam |
| `read:graph:issue:jira` | Teamwork Graph | JiraWorkItem |
| `read:graph:issue-status:jira` | Teamwork Graph | JiraWorkItemStatus, selected on work items |
| `read:graph:issue-comment:jira` | Teamwork Graph | JiraWorkItemComment |
| `read:graph:project:jira` | Teamwork Graph | JiraSpace: start node of `atlassianTeamsBySpace` |

Teamwork Graph needs a scope for **every object type traversed**. A missing scope does not raise an error; rows are silently omitted. That is why each action reports `status: empty` separately from `error`. No write scopes or wildcard scopes are requested.

## Teamwork Graph

**Mechanism:** `api.asUser().requestTeamworkGraph(query, variables, operationName)`. The `@forge/api` 8.5 typings are `(query, variables?, operationName?, extensions?, headers?)`. The response is `{ data, errors }`.

**Curated queries used** (`src/services/teamworkGraph/queries.ts`):

| Query | Arguments | Node type and fields selected | Used for |
| --- | --- | --- | --- |
| `atlassianUserAssignedJiraWorkItems` | `userId: ID!` (user ARI) | `JiraWorkItem { id issueId key summary webUrl dueAt status { name statusCategory { key } } issueType { name } }` | My work |
| `atlassianUserInTeams` | `userId: ID!` | `AtlassianTeam { id displayName description profileUrl }` | Team discovery |
| `atlassianTeamMembers` | `teamAri: ID!` | `AtlassianUser { id accountId name }` | Team members |
| `atlassianTeamsBySpace` | `spaceAri: ID!` (Jira project ARI) | `AtlassianTeam {...}` | Teams linked to an issue's project |
| `jiraWorkItemComments` | `id: ID!` (issue ARI), `since: String!` (`P90D`) | `JiraWorkItemComment { id createdAt deleted author { name } }` | Discussion participants |
| `echo` | `myString` | scalar | Connectivity status in the dashboard header |

- **Pagination:** Relay connections (`edges { node }`, `pageInfo { hasNextPage endCursor }`), `first` capped at 25. `paginateConnection` follows `endCursor` up to a per-query page limit and reports `hasMore`.
- **Unions:** nodes are selected with inline fragments, and `__typename` filters out unexpected member types.
- **ARIs** (`aris.ts`): `ari:cloud:identity::user/{accountId}`, `ari:cloud:identity::team/{id}`, `ari:cloud:jira:{cloudId}:issue/{issueId}`, `ari:cloud:jira:{cloudId}:project/{projectId}`. `cloudId` comes from the Rovo payload context or from the install context ARI.
- **Errors:** an HTTP 401/403/429 response, or `data == null`, is classified as `UNSUPPORTED` (unknown field, i.e. schema drift), `PERMISSION_DENIED` (scope or permission), `RATE_LIMITED`, or `UPSTREAM_ERROR`. Partial data that comes with errors is kept.
- **Limitations:**
  - The Teamwork Graph API is in Forge *Preview*.
  - Raw `cypherQuery` is unavailable to new apps, so only curated queries are used.
  - Installing an app with Teamwork Graph scopes requires an **org admin**.
  - The API only works for apps installed in Jira or Confluence.
- **Not available via curated queries:**
  - Issue-to-issue links, parent and child hierarchy, and remote links. These come from Jira REST.
  - Priority and project on `JiraWorkItem`. These are enriched from Jira.

## Jira Cloud REST v3

| Endpoint | Function |
| --- | --- |
| `GET /rest/api/3/myself` | `getCurrentUser` |
| `GET /rest/api/3/serverInfo` | `getSiteInfo`: site URL for browse links (cached per warm instance) |
| `GET /rest/api/3/search/jql?jql=&fields=&maxResults=&nextPageToken=` | `searchIssues`: enhanced search with token pagination. The legacy `/rest/api/3/search` is deprecated and not used. |
| `GET /rest/api/3/issue/{key}?fields=` | `getIssue` |
| `GET /rest/api/3/issue/{key}/comment?orderBy=-created&maxResults=100` | `getIssueComments` |
| `GET /rest/api/3/issue/{key}/watchers` | `getIssueWatchers`. Needs "View voters and watchers"; if denied, it is reported as unavailable. |
| `GET /rest/api/3/issue/{key}/remotelink` | `getIssueRemoteLinks` |

JQL used:

- `assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC`
- `assignee in ("id", …) AND statusCategory != Done ORDER BY priority DESC, updated DESC`
- `project = "KEY" AND statusCategory != Done …`
- `parent = "KEY" ORDER BY rank ASC`

All values are quoted and escaped (`quoteQueryString`) and URL-encoded by `route`.

## Confluence (optional)

`GET /wiki/rest/api/search?cql=type = page AND text ~ "<terms>" ORDER BY lastmodified DESC&limit=6&excerpt=indexed`

- Search terms come from the issue summary, with ticket boilerplate words removed, or from the user's query.
- Highlight markers and HTML are stripped from excerpts. URLs are made absolute using `_links.base`.
- **Requirement:** `requestConfluence` works only when the app is also installed on the site's Confluence. Otherwise the action returns the Jira-linked documents and reports Confluence as `unavailable`.

## Rovo agent and actions

The agent is `context-guide`, named "Teamwork Insight Context Guide" because of the 30-character name limit. Its prompt is in `prompts/context-guide.txt`.

Handlers receive `(payload, context)`. Inputs are keys of `payload`, and `payload.context` may carry `cloudId` and `jira.{issueKey, projectKey}` when the user is on an issue. `context.principal.accountId` identifies the user.

| Action key | Handler | Inputs (all optional) | Output (`result`) |
| --- | --- | --- | --- |
| `get-my-work` | `myWorkSummary` | `includeDone: boolean`, `limit: integer 1–25`, `projectKey: string` | `MyWorkResult`: user, totals, items[], suggestedFocus[], truncated, sources[], notes[] |
| `get-team-workload` | `teamWorkload` | `teamName`, `teamId`, `projectKey` | `TeamWorkloadResult`: `status: ok` (scope, members[], totals, highLoadMembers, membersWithoutWork, topPriorityItems, disclaimer), or `needs_team_selection` / `no_team` with teams[] and a message |
| `get-issue-people` | `issuePeople` | `issueKey` (falls back to the context issue) | `IssuePeopleResult`: issue, assignee, reporter, creator, commenters[], watchers, teams[], suggestedContacts[] |
| `find-related-work` | `relatedWork` | `issueKey` | `RelatedWorkResult`: parent, children[], links[], blockedBy[], blocks[], isBlocked, remoteLinks[] |
| `find-blocked-work` | `blockedWork` | `projectKey` | `BlockedWorkResult`: items[] with blockers[] and allBlockersResolved |
| `find-related-docs` | `relatedDocs` | `issueKey`, `query` | `RelatedDocsResult`: documents[] with `via: jira_remote_link | confluence_search` |

Every response has the shape `{ ok: true, result }` or `{ ok: false, error: { code, message } }`. Error codes: `INVALID_INPUT`, `NOT_FOUND`, `PERMISSION_DENIED`, `AUTH_REQUIRED`, `RATE_LIMITED`, `TIMEOUT`, `UNSUPPORTED`, `UPSTREAM_ERROR`, `INTERNAL`. TypeScript types are in `src/types/domain.ts`.

## MCP tools (`rovo:mcp`)

The `teamwork-insight-mcp` module (name "Teamwork Insight") lists the six action keys as `tools`. In Forge, MCP tools *are* actions, so they share inputs, handlers and permission checks. No separate MCP server is built.

- **Rovo Studio:** add the "Teamwork Insight" tools to a custom agent under *Connected apps*.
- **External MCP clients (Preview):**
  1. A site or org admin must enable external MCP access for the installation in Atlassian Administration.
  2. The endpoint is `https://mcp.atlassian.com/forge/<appId>`, where `<appId>` is the UUID part of `app.id`.
- **Permissions:** tools run `asUser()`. If a remote client has no user consent, Forge raises `NeedsAuthenticationError`, which is returned as `AUTH_REQUIRED` with instructions. The app deliberately does **not** fall back to `asApp()`, which would bypass the user's permissions.

## Custom UI resolver functions

`getStatus`, `getMyWork`, `getMyTeams`, `getTeamWorkload({teamId?, projectKey?})`, `getIssueContext({issueKey})`, `getBlockedWork({projectKey?})`, `getRelatedDocs({issueKey?, query?})`, `ask({question})`. Each returns `{ ok: true, data }` or `{ ok: false, error }`.

## Verification log (2026-11-15)

| Item | Source |
| --- | --- |
| `requestTeamworkGraph` signature, Preview status, scopes behaviour | developer.atlassian.com/platform/forge/call-the-teamwork-graph-api; `@forge/api` 8.5.0 typings |
| Curated query catalog, args, 25-item cap, Relay shape, inline fragments | developer.atlassian.com/platform/teamwork-graph/curated-queries |
| JiraWorkItem / AtlassianUser / AtlassianTeam / JiraWorkItemComment fields | …/teamwork-graph/api-reference/object-types/* |
| ARI formats | …/teamwork-graph/understanding-aris, …/direct-object-querying |
| Teamwork Graph scopes | …/teamwork-graph/scopes |
| Org-admin install requirement, Runs-on-Atlassian recommendation | …/teamwork-graph/limitations-and-considerations |
| `rovo:agent` schema (name ≤ 30 chars, prompt resource, starters, followUpPrompt) | …/forge/manifest-reference/modules/rovo-agent |
| `action` schema (actionVerb, inputs, description ≤ 255 chars), payload/context | …/forge/manifest-reference/modules/rovo-action; schema validator |
| `rovo:mcp` schema (key, name ≤ 30, tools), external endpoint | …/forge/manifest-reference/modules/rovo-mcp, …/read-jira-issues-with-a-rovo-mcp-tool |
| Function `context.principal.accountId`, `installContext` | …/forge/function-reference/arguments |
| `jira:globalPage` props | …/forge/manifest-reference/modules/jira-global-page |
| `rovo.open` / `rovo.isEnabled` bridge | …/forge/apis-reference/ui-api-bridge/rovo; `@forge/bridge` 7.3.0 typings |
| Runtimes (`nodejs24.x` recommended) | …/forge/manifest-reference |
| Jira endpoints and scopes, `/search` deprecated | Jira Cloud OpenAPI v3 (`swagger-v3.v3.json`) |
| Confluence `GET /wiki/rest/api/search` + `search:confluence` | …/cloud/confluence/rest/v1/api-group-search |
| Forge pricing | …/forge/forge-platform-pricing (updated 2026-08-12) |
