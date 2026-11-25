# Implementation Status

Progress tracker for Teamwork Insight, kept current so work can resume across sessions.
**Last updated:** 2026-11-15

## TL;DR: where things stand

- Phases 0–7 are **code-complete and locally verified**: typecheck, lint, 107 unit and mock-integration tests, UI build, and offline manifest schema validation all pass.
- **Nothing has been deployed or live-tested yet.** Deployment needs an Atlassian account login (`forge login`) and a developer site with Rovo. This is blocked on the user (see *Blockers*).
- Next session: run the **Live verification checklist** below, then record the results here.

## Verification legend

| Mark | Meaning |
| --- | --- |
| ✅ | Implemented and verified locally (unit or mock tests, build, schema validation) |
| 🟡 | Implemented, awaiting **live** verification on an Atlassian site |
| ⛔ | Blocked on an external dependency |
| ⬜ | Not started |

## Phase checklist

### Phase 0: Repository inspection ✅
- [x] Repo contained only `prompt.md` and `Project-Report.md`. No scaffold, no git, no Forge CLI.
- [x] Every Forge, Rovo and Teamwork Graph API used was verified against official docs (see `docs/API-INTEGRATION.md`, "Verification log").
- [x] Forge CLI installed: **14.2.0**. CLI 15.x requires Node ^22.23.4 / ^24.22.1 / >=26.12.1, and this machine has Node 24.18.0.

### Phase 1: Forge foundation ✅ / 🟡
- [x] `manifest.yml`: runtime `nodejs24.x` (Atlassian's recommended runtime), least-privilege scopes
- [x] TypeScript backend, ESLint (flat config), Prettier, Jest (ts-jest)
- [x] Custom UI (React 18 + Vite 6) in `static/dashboard`
- [x] Manifest passes the Forge schema validator offline (`npm run validate:manifest`)
- [ ] ⛔ `app.id` is a placeholder: `forge register` will write the real one (needs `forge login`)
- [ ] ⛔ `forge lint` / `forge deploy` (need `forge login`)

### Phase 2: Jira integration ✅ / 🟡
- [x] Current user (`/rest/api/3/myself`), site URL (`/rest/api/3/serverInfo`)
- [x] Enhanced JQL search (`/rest/api/3/search/jql`, token pagination); the deprecated `/search` endpoint is not used
- [x] Issue detail, comments, watchers, remote links, issue links, parent/children
- [ ] 🟡 Live test against real Jira data

### Phase 3: Teamwork Graph ✅ / 🟡
- [x] Client: `api.asUser().requestTeamworkGraph(query, variables, operationName)`, error classification, 25-per-page pagination
- [x] Curated queries: `atlassianUserAssignedJiraWorkItems`, `atlassianUserInTeams`, `atlassianTeamMembers`, `atlassianTeamsBySpace`, `jiraWorkItemComments`, plus `echo` (connectivity)
- [x] Scopes: `read:graph:user:atlassian`, `read:graph:team:atlassian`, `read:graph:issue:jira`, `read:graph:issue-status:jira`, `read:graph:issue-comment:jira`, `read:graph:project:jira`
- [ ] 🟡 Live test of every query. Watch especially:
  - `JiraWorkItemComment.author { name }`: the `User` type's selectable fields were inferred from the docs' `assignee { name }` example. Verify in GraphiQL.
  - `atlassianTeamsBySpace` with a Jira project ARI

### Phase 4: Rovo agent ✅ / 🟡
- [x] Agent `context-guide`, named **"Teamwork Insight Context Guide"** (the spec's "Teamwork Insight – Context Guide" is 32 characters; the documented limit is 30)
- [x] Prompt in `prompts/context-guide.txt` (grounding, facts vs. suggestions, citations)
- [x] Six `action` modules (all `actionVerb: GET`): `get-my-work`, `get-team-workload`, `get-issue-people`, `find-related-work`, `find-blocked-work`, `find-related-docs`
- [ ] 🟡 Natural-language testing in Rovo chat

### Phase 5: Dashboard ✅ / 🟡
- [x] `jira:globalPage` dashboard: header with Graph/Rovo status, stat tiles, my work, suggested focus, team workload (bars, team picker, project fallback), issue lookup, Ask panel
- [x] `jira:issueContext` panel: people, related work and docs for the open issue, plus "Ask Rovo about this issue"
- [x] Loading (skeleton), empty and error states. Design tokens with theme support. Responsive breakpoints at 960px and 600px.
- [x] The Ask panel is a **deterministic router** (`src/assistant/router.ts`), not an LLM. It hands off to the real Rovo agent via `rovo.open`.
- [ ] 🟡 Visual check inside Jira (light and dark), plus screenshots for the README

### Phase 6: Additional integrations ✅ / 🟡
- [x] Related work and dependencies, blocked work, issue people
- [x] Confluence: issue remote links plus CQL search (`/wiki/rest/api/search`, scope `search:confluence`); degrades gracefully
- [x] `rovo:mcp` module exposing all six actions as MCP tools
- [ ] 🟡 Confluence search requires the app to also be installed on the site's Confluence. Verify live.
- [ ] 🟡 MCP: an admin must enable external MCP per installation. Test from Rovo Studio and an external client.

### Phase 7: Quality and security ✅
- [x] All Atlassian calls use `asUser()`; there is no `asApp()` anywhere (grep-verified)
- [x] Identity comes only from `context.principal.accountId`, never from inputs
- [x] Input validation, JQL/CQL quoting, safe error envelopes (no raw upstream messages or stack traces)
- [x] PII-free structured logging
- [x] No storage, no egress, no external services, no paid APIs
- [x] Dead code removed. Prettier clean.

### Phase 8: Deployment and demo ⛔
- [ ] Deploy to the development environment and install on a Jira site
- [ ] Create the demo dataset (see `docs/DEMO.md`)
- [ ] Record the demo, take screenshots, write the Codegeist submission
- [ ] Push to GitHub (user's call: repo name and visibility)

## Acceptance criteria (prompt.md §18)

| Criterion | Status |
| --- | --- |
| Forge app scaffolded correctly | ✅ schema-valid |
| Deploys / installs / accessible | ⛔ needs login |
| Current user identified | 🟡 |
| My Work returns real items | 🟡 |
| Team Workload uses real team data | 🟡 |
| Issue People / Related Work real data | 🟡 |
| Rovo agent invokes actions; answers grounded | 🟡 |
| Errors handled gracefully | ✅ (mock-tested) |
| Official TWG mechanism; ≥1 curated query live | ✅ / 🟡 |
| Scopes configured; parsing; permission limits handled | ✅ / 🟡 |
| UI polished, loading/empty/error states, links, responsive | ✅ / 🟡 (visual check pending) |
| Unit tests, type checking, linting pass | ✅ |
| No critical security issues; no paid hosting | ✅ |
| Documentation complete | ✅ (screenshots pending) |
| Bonus eligibility (Rovo / TWG / MCP) | 🟡 implemented; needs live demo |

## Live verification checklist (next session)

1. `forge login`, then `forge register "Teamwork Insight"` (writes `app.id`).
2. `npm run deploy`, then `forge install --site <site>.atlassian.net --product jira`. **An org admin must install** (Teamwork Graph scopes).
3. Optional: `forge install --product confluence` on the same site (Confluence search).
4. `forge logs` while exercising each item below. Record pass/fail here:
   - [ ] Dashboard header: Teamwork Graph "Connected"
   - [ ] My work shows Graph-sourced items with priority
   - [ ] Team workload: team found, members listed, counts correct
   - [ ] Issue lookup: people (assignee, reporter, commenters), related work, teams
   - [ ] Issue context panel renders on an issue
   - [ ] Docs: linked docs, plus Confluence matches if installed
   - [ ] Rovo: each conversation starter calls the right action
   - [ ] Rovo Studio: add the "Teamwork Insight" MCP tools to a custom agent
   - [ ] External MCP client via `https://mcp.atlassian.com/forge/<appId>` (after admin enablement)
   - [ ] Permission boundary: a second user without project access gets NOT_FOUND, not data

## Blockers

1. **Atlassian login** (user action): run `! forge login` in this session (it is interactive) or set `FORGE_EMAIL` / `FORGE_API_TOKEN`.
2. **Developer site with Rovo enabled**, plus org-admin rights to install an app with Teamwork Graph scopes.
3. *(Recommended)* Upgrade Node to ≥ 24.22.1 to use Forge CLI 15.x (`npm i -g @forge/cli@latest`).
4. **Billing details:** Forge requires a billing method in the Developer Console. Expected usage is far below the free allowance.

## Decisions and deviations

| Topic | Decision | Why |
| --- | --- | --- |
| Agent name | "Teamwork Insight Context Guide" | 30-character limit on `rovo:agent.name` |
| Action/tool keys | `get-my-work`, `get-team-workload`, `get-issue-people`, `find-related-work`, `find-blocked-work`, `find-related-docs` | MCP tools *are* action keys (`rovo:mcp.tools` references actions), so one name serves both. Handlers keep the spec's names (`myWorkSummary`, ...). |
| Runtime | `nodejs24.x` | Atlassian's recommended runtime (Node 22 is also supported) |
| Priority and project for my work | Graph items enriched by a parallel Jira JQL search | `JiraWorkItem` in Teamwork Graph has no priority or project field |
| Team workload aggregation | Graph for team and members, one batched JQL for open issues | JQL filters done work server-side and returns priority. Per-member Graph calls would include closed work and need N calls. |
| Related work, blocked work | Jira REST | No curated query covers issue links or hierarchy |
| MCP auth | `asUser()` only; consent errors are reported | The tutorial suggests `asApp()` for remote calls, but that bypasses user permissions |
| Dashboard Ask box | Deterministic router plus `rovo.open` hand-off | No paid LLM. Answers are always live data. |
| Confluence | Remote links (always) plus CQL search (when installed in Confluence) | Requires a cross-product install. Kept optional. |

## Session log

- **2026-11-15, session 1:** Phases 0–7 implemented. Docs verified. 107 tests passing. Live deployment blocked on login.
