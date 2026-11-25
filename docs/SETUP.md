# Local setup

## Prerequisites

- **Node.js:** 22.x or 24.x.
  - Forge CLI **15.x** needs Node `^22.23.4`, `^24.22.1` or `>=26.12.1`.
  - On older Node, use Forge CLI 14.2.0 (`npm i -g @forge/cli@14.2.0`). Upgrading Node is recommended.
- **Forge CLI:** `npm install -g @forge/cli`
- An **Atlassian account**, plus a Jira Cloud site you administer: for example a free developer site from https://go.atlassian.com/cloud-dev.
- **Rovo** enabled on that site, for the agent and MCP features. The dashboard works without Rovo.
- **Org admin rights** to install the app, which Teamwork Graph scopes require.

## Install

```bash
npm install            # backend + tooling
npm run install:ui     # Custom UI (static/dashboard)
```

## Verify locally (no Atlassian login needed)

```bash
npm run validate
# = typecheck (backend + UI) → eslint (backend + UI) → jest → vite build → manifest schema check
```

`npm run validate:manifest` checks `manifest.yml` against the Forge manifest schema bundled with the CLI, with no login. Build the UI first, because resource paths are validated too.

## Log in and register

```bash
forge login                         # interactive; or set FORGE_EMAIL + FORGE_API_TOKEN
forge register "Teamwork Insight"   # replaces the placeholder app.id in manifest.yml
```

API tokens: https://id.atlassian.com/manage-profile/security/api-tokens

## Develop

```bash
npm run deploy                                    # builds the UI, then forge deploy (development env)
forge install --site <site>.atlassian.net --product jira
forge tunnel                                      # live-reload backend changes against the installed app
```

UI changes need `npm run build:ui` and a redeploy, or a tunnel. Open the app in Jira under **Apps → Teamwork Insight**.

## Project scripts

| Script | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` for backend and UI |
| `npm run lint` | ESLint for backend and UI |
| `npm test` / `npm run test:coverage` | Jest |
| `npm run build:ui` | Vite build to `static/dashboard/build` |
| `npm run validate:manifest` | Offline manifest schema validation |
| `npm run validate` | All of the above |
| `npm run format` / `format:check` | Prettier |
| `npm run deploy` | Build the UI, then `forge deploy` |
| `npm run lint:forge` | `forge lint` (requires login) |
