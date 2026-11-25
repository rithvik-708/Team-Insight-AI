# Deployment

## 1. Log in

```bash
forge login
```

This is interactive. For CI, set `FORGE_EMAIL` and `FORGE_API_TOKEN` as environment variables instead.

## 2. Register the app (first time only)

```bash
forge register "Teamwork Insight"
```

This writes the real `app.id` into `manifest.yml`, replacing the placeholder.

## 3. Deploy

```bash
npm run validate                       # recommended gate
npm run build:ui
forge deploy                           # development environment (default)
forge deploy -e staging                # optional
forge deploy -e production
```

Teamwork Graph, `rovo:agent`, `action` and `rovo:mcp` work in every environment.

## 4. Install

```bash
forge install --site <site>.atlassian.net --product jira                 # development
forge install --site <site>.atlassian.net --product jira -e production
forge install --site <site>.atlassian.net --product confluence           # optional: Confluence search
```

- Installation must be done by an **organization admin**, because Teamwork Graph scopes give organization-wide data access.
- After changing scopes, run `forge install --upgrade`.

## 5. Distribution link (for judges and testers)

1. Deploy to **production**.
2. In the Developer Console (https://developer.atlassian.com/console/myapps/), open the app, then **Distribution**, and enable sharing.
3. Generate the installation link.
4. Share the link together with the requirements: an org admin installs it, and Rovo must be enabled on the site.

## 6. Enable MCP for external clients (optional, Preview)

1. In Atlassian Administration, a site or org admin enables external MCP access for the Teamwork Insight installation. It is disabled by default.
2. Point an MCP client at `https://mcp.atlassian.com/forge/<appId>`, where `<appId>` is the UUID part of `app.id`.
3. Within Rovo, no extra step is needed: in Rovo Studio, create an agent and add the "Teamwork Insight" tools under *Connected apps*.

## Environment configuration

The app has **no environment variables or secrets**. All Atlassian access goes through Forge's built-in `asUser()` auth. No external services are called.

## Logs and monitoring

```bash
forge logs -e development --since 30m
```

Log lines are JSON:
- `{"app":"teamwork-insight","event":"action.ok","action":"myWorkSummary","ms":812}`
- `resolver.ok`, `action.failed` (with an error code), `teamworkGraph.errors`

Usage metrics are in the Developer Console.

## Cost and usage

Per the Forge pricing page (last updated 2026-08-12), each app gets a free monthly allowance, and overage is billed to the developer:

| Capability | Free / month | This app |
| --- | --- | --- |
| Functions duration | 200,000 GB-s | ~0.25–0.75 GB-s per call at 256 MB → several hundred thousand calls free |
| Logs writes | 1 GB | A few short JSON lines per call |
| KVS, SQL, Object Store | small allowances | **Not used** |
| Forge LLM, Containers | no free allowance | **Not used** |

- **Rovo:** agent conversations consume the **customer organization's** Rovo credits, not the developer's. The developer pays only for Forge compute and logs when an action runs.
- **Billing setup:** Forge requires billing details in the Developer Console for consumption-based pricing. Expected usage for this app stays inside the free allowance, but add a payment method to avoid interruption. Usage in development and staging environments also counts.
- **Customer requirements:** a Jira Cloud plan with Rovo enabled. Confluence is optional.

**Staying within free limits:**
- Memory is set to 256 MB.
- Graph pagination is capped (4 pages for my work, 2 for teams, 4 for members).
- JQL is capped (100 / 200 / 300 issues).
- Nothing is polled; every query runs on demand.
