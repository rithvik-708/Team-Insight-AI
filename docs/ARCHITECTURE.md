# Architecture

## Structure

```
manifest.yml                 Forge modules, functions, resources, scopes
prompts/context-guide.txt    Rovo agent instructions (manifest resource)
src/
  index.ts                   Function entry points referenced by the manifest
  handlers/
    rovoActions.ts           Rovo action and MCP tool adapters (validate, call action, envelope)
    resolver.ts              Custom UI resolver functions
    context.ts               Builds RequestContext from the Forge context (identity, cloudId, issue)
  actions/                   Business logic, one file per capability
    myWorkSummary.ts  teamWorkload.ts  issuePeople.ts
    relatedWork.ts    blockedWork.ts   relatedDocs.ts   shared.ts
  assistant/router.ts        Deterministic question router for the dashboard Ask box
  services/
    http.ts                  Timeout + JSON + HTTP status → AppError mapping
    jira/                    client.ts (asUser requestJira, site info), issues.ts (endpoints + parsing)
    teamworkGraph/           client.ts (requestTeamworkGraph, pagination, error classification),
                             queries.ts (curated GraphQL), aris.ts, workItems.ts, teams.ts
    confluence/search.ts     CQL search
  types/                     domain.ts (normalised, shared with the UI), jira.ts, teamworkGraph.ts, actions.ts
  utils/                     errors.ts, validation.ts, formatting.ts, logging.ts
static/dashboard/            Custom UI (React + Vite), built to static/dashboard/build
tests/                       Jest unit and mock-integration tests
scripts/validate-manifest.js Offline manifest schema validation
```

## Forge modules

| Module | Key | Purpose |
| --- | --- | --- |
| `rovo:agent` | `context-guide` | "Teamwork Insight Context Guide": prompt, 6 conversation starters, follow-up prompt, 6 actions |
| `action` ×6 | `get-my-work`, `get-team-workload`, `get-issue-people`, `find-related-work`, `find-blocked-work`, `find-related-docs` | Read-only (`actionVerb: GET`) actions with typed inputs |
| `rovo:mcp` | `teamwork-insight-mcp` | Exposes the 6 actions as MCP tools |
| `jira:globalPage` | `teamwork-insight-page` | Dashboard (Custom UI) |
| `jira:issueContext` | `teamwork-insight-issue-context` | Issue panel: people, related work, docs (same Custom UI bundle) |
| `function` ×7 | `resolver-fn`, `*-fn` | Handlers in `src/index.ts` |

The Custom UI bundle detects which module it is rendered in via `view.getContext().extension.type` and shows either the dashboard or the compact issue panel.

## Backend layering

1. **Handlers** are thin adapters. They read identity from the Forge context (`principal.accountId` for actions, `context.accountId` for resolvers) and validate and normalise inputs. Rovo can pass LLM-filled strings such as `"10"` or `"true"`, so the parsers accept loose forms. Handlers resolve the issue key from inputs or from the surrounding Jira context, call one action, and return `{ ok: true, result }` or `{ ok: false, error: { code, message } }`. They never throw to Rovo, so the agent can explain failures.
2. **Actions** hold the business rules: merging sources, filtering done work, sorting, aggregation, team selection, contact reasons, and focus heuristics. The pure parts (`aggregateWorkload`, `selectTeam`, `suggestFocus`, `mergeCommenters`, `suggestContacts`) are exported and unit-tested.
3. **Services** wrap one Atlassian API each, parse responses defensively into normalised types, and map failures to `AppError` codes.

Every result carries `sources[]`, which records which API supplied which part, with status `ok | empty | unavailable | error`. Results also carry `notes[]` for caveats such as truncation, stale graph items or unavailable Confluence. The agent prompt and the UI both surface these, so provenance is always visible.

## Data flow examples

**"What am I working on?"**
1. Rovo calls `get-my-work`. `myWorkSummaryAction` builds the context from `principal.accountId`.
2. In parallel:
   - Teamwork Graph `atlassianUserAssignedJiraWorkItems(userId: ari:cloud:identity::user/<id>)`, up to 4 pages of 25
   - Jira `search/jql`: `assignee = currentUser() AND statusCategory != Done`
   - `/myself` and `/serverInfo`
3. Merge. Graph items are the base. Jira supplies priority and project, which the Graph type lacks, and live status. Graph items that Jira no longer reports as open and assigned are dropped as stale, with a note. Jira-only items are added, labelled `source: jira`.
4. Filter, sort (overdue → priority → in progress → due date → recency), compute totals and suggested focus, return JSON.
5. Rovo formats the answer following the prompt rules: cite keys and links, separate facts from suggestions.

**"What is my team working on?"**
1. Teamwork Graph `atlassianUserInTeams`. No team → `no_team`. Several teams and none named → `needs_team_selection`; the app never silently picks the first.
2. Teamwork Graph `atlassianTeamMembers(teamAri)`.
3. One JQL search `assignee in (...) AND statusCategory != Done`, batched in groups of 50 and capped at 300 issues.
4. `aggregateWorkload`: per-member counts, status distribution, load flags (high = ≥5 open and ≥1.5× the team average), members without assigned work, top-priority items, and a disclaimer.

## Frontend

- `services/api.ts` wraps `invoke` and unwraps the envelope into data or an `ApiError`. Links open through `router.open`, because Custom UI runs in an iframe. `rovo.isEnabled()` and `rovo.open({ type: 'forge', agentKey, agentName, prompt })` hand off to the agent.
- `hooks/useAsync.ts` tracks loading, error and data, with cancellation and reload.
- Components:
  - `ui.tsx`: card, lozenge, priority, source badges, states, avatar
  - `WorkItemList`, `MyWork`, `TeamWorkload`, `IssueContext`
  - `AskPanel`: chat history, suggestions, action labels
  - `Sections`: stat tiles, cards
- Styling is plain CSS on Atlassian design tokens (`--ds-*`, loaded with `view.theme.enable()`, so light and dark themes work), with ADS light-theme fallbacks. Inline style attributes are not used, except bar widths set through React's `style` prop (CSSOM), which Forge's CSP allows.

## Security model

- Every product call uses `api.asUser()`: Jira, Confluence and Teamwork Graph return only what the invoking user can see. No `asApp()` anywhere.
- Identity comes only from the Forge context. Inputs are never used for authorization.
- Inputs are validated with regex allowlists for issue, project and team keys. Free text is control-character-stripped, length-capped and escaped before going into JQL/CQL. JQL values are passed through Forge's `route` template, which URL-encodes them.
- Errors are mapped to stable codes and user-safe messages. Raw upstream messages and stack traces never reach users.
- Logs hold only operation names, durations, counts and error codes. No names, emails, issue content or tokens.
- No persistence: no KVS or SQL. Nothing is stored about users or issues. The only cache is the site URL from `serverInfo`, held in memory per warm runtime.
- No egress. Recommended for Teamwork Graph apps ("Runs on Atlassian").
