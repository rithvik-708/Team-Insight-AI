# Teamwork Insight

**Organizational context for software teams, inside Jira.** Built on Atlassian Forge, Rovo and Teamwork Graph.

Teamwork Insight answers the questions developers and managers ask every day, using live data from your Atlassian site:

- *What am I working on?* / *What should I focus on next?*
- *What is my team working on?* / *Who is overloaded?*
- *Who is involved in MKT-21? Who should I contact?*
- *What is related to this feature? Is it blocked?*
- *Are there documents for this?*

It is not another Jira chatbot. Each answer comes from deterministic actions that query **Teamwork Graph** and **Jira** as the signed-in user. **Rovo** handles the conversation. Every answer shows where its data came from.

## The problem

Context is scattered across Jira projects, issue links, comments, teams and Confluence. People lose time switching between boards and filters to find who owns what, what their team is doing, and which work and docs relate to a feature. Ownership stays unclear, and work gets duplicated.

## Features

| Feature | Where | Data sources |
| --- | --- | --- |
| **My Work Summary**: open assigned work sorted by urgency, totals, deterministic "suggested focus" with reasons | Rovo, dashboard, MCP | Teamwork Graph `atlassianUserAssignedJiraWorkItems` + Jira JQL (priority/project) |
| **Team Workload**: your team, its members, open-issue counts, status mix, high-load and no-work flags, top priorities. Asks which team when you are in several. | Rovo, dashboard, MCP | Teamwork Graph `atlassianUserInTeams`, `atlassianTeamMembers` + Jira JQL |
| **Issue People**: owner, reporter, discussion participants, watchers, teams linked to the project, suggested contacts with reasons | Rovo, dashboard, issue panel, MCP | Jira REST + Teamwork Graph `jiraWorkItemComments`, `atlassianTeamsBySpace` |
| **Related Work**: parent, children, linked issues, blockers and blocked issues, web links | Rovo, dashboard, issue panel, MCP | Jira REST |
| **Blocked Work**: open issues with unresolved "is blocked by" links (yours or a project's), with stale-link detection | Rovo, dashboard, MCP | Jira JQL |
| **Related Docs**: documents linked from the issue, plus Confluence pages matching it | Rovo, dashboard, issue panel, MCP | Jira remote links + Confluence CQL search |

The Rovo agent **Teamwork Insight Context Guide** uses all six actions. The same actions are exposed as **MCP tools** (`rovo:mcp`) for Rovo Studio agents and, once an admin enables it, for external MCP clients.

## How it works

```
 Rovo chat / Rovo Studio / MCP clients        Jira global page + issue panel (Custom UI)
               │  action modules                          │  @forge/bridge invoke
               ▼                                          ▼
       src/handlers/rovoActions.ts               src/handlers/resolver.ts
               └────────────────┬─────────────────────────┘
                                ▼
                 src/actions/*: business logic (pure aggregation, sorting, merging)
                                ▼
     services/teamworkGraph      services/jira             services/confluence
     requestTeamworkGraph        requestJira                requestConfluence
                     (all api.asUser(): results respect the user's permissions)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Technology

- Atlassian Forge (Node.js 24 runtime), TypeScript, `@forge/api`, `@forge/resolver`
- Rovo `rovo:agent` + `action` modules, and `rovo:mcp`
- Teamwork Graph API (curated GraphQL queries)
- Custom UI with React 18 and Vite, `@forge/bridge`, Atlassian design tokens, Lucide icons
- Jest (ts-jest), ESLint, Prettier

No external servers, databases, paid AI APIs or storage. Everything runs on Forge.

## Screenshots

> Screenshots will be added after the first live deployment (see `IMPLEMENTATION-STATUS.md`). The UI is never shown with fabricated data.

## Getting started

```bash
npm install && npm run install:ui
npm run validate          # typecheck, lint, tests, UI build, manifest schema check
forge login
forge register "Teamwork Insight"
npm run deploy
forge install --site <your-site>.atlassian.net --product jira
```

Full instructions are in [docs/SETUP.md](docs/SETUP.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

**Requirements for live use:** a Jira Cloud site with Rovo enabled. An **organization admin** must install the app, because Teamwork Graph scopes require it.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API integration: Jira, Teamwork Graph, Rovo, MCP, Confluence, scopes](docs/API-INTEGRATION.md)
- [Setup](docs/SETUP.md) · [Testing](docs/TESTING.md) · [Deployment](docs/DEPLOYMENT.md)
- [Demo script and dataset](docs/DEMO.md)
- [Implementation status](IMPLEMENTATION-STATUS.md)

## Cost

Designed to run inside Forge's free allowance: 200,000 GB-seconds of function compute and 1 GB of logs per app per month. The app uses no KVS, SQL, object storage, Forge LLM or containers. Rovo credits for agent conversations come from the customer's organization, not the developer. Details are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#cost-and-usage).

## License

[MIT](LICENSE)
