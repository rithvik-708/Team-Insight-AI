# Demo guide

All demo data must be **real Jira data created on the test site**. The app has no hardcoded or sample responses. The keys below are what a fresh project would typically produce; use whatever keys your site actually generates.

## Demo dataset (create manually on the test site)

**People:** you (demo presenter), plus two or three teammates (invite test users), e.g. Alice (design), Bob (dev), Carol (QA).

**Atlassian team** (Atlassian Home → Teams): "Marketing Squad" with you, Alice, Bob and Carol. Link it to the Jira project if your site supports team–space links. Optionally create a second team so the "which team?" clarification can be shown.

**Jira project** `MarketingSite` (key `MKT`), with issues:

| Key | Summary | Assignee | Status | Priority | Extras |
| --- | --- | --- | --- | --- | --- |
| MKT-1 | Marketing website launch (Epic) | You | In Progress | High | Parent of 21–23 |
| MKT-21 | Design landing page | You | In Progress | High | Reporter: Bob. Comments from Bob and Carol. Remote link to the Confluence "Launch plan" page |
| MKT-22 | Implement signup form | You | To Do | Medium | "is blocked by" MKT-21. Due date in the past (overdue) |
| MKT-23 | Write unit tests | You | In Progress | High | "relates to" MKT-22 |
| MKT-24 | Hero illustrations | Alice | To Do | Medium | |
| MKT-25…29 | Assorted tasks | Alice | To Do / In Progress | mixed | Gives Alice a visibly high load |
| MKT-30 | Signup API endpoint | Bob | In Progress | Highest | "blocks" MKT-22 |
| MKT-31 | Cross-browser QA | Carol | To Do | Medium | |

**Confluence** (optional; requires the app to be installed in Confluence): a page "Launch plan – marketing website" and a page "Landing page design guidelines" in space MKT.

## Demo script (about 4 minutes)

1. **Intro (20s):** "Teamwork Insight is a Forge app that gives Rovo real organizational context through Teamwork Graph and Jira, so answers come from your data, not guesswork."
2. **Dashboard (40s):** Open *Apps → Teamwork Insight*.
   - Point out the header status: *Teamwork Graph: Connected*, *Rovo: Enabled*.
   - Show the tiles (open, high priority, overdue), *My work* with priorities and links, and *Suggested focus*, which is labelled as a suggestion and lists its reasons.
   - Hover a source badge: "via Teamwork Graph".
3. **Demo 1, personal work (40s):** Open Rovo, choose *Teamwork Insight Context Guide*, and pick "What am I working on?". The agent calls `get-my-work` and lists MKT-21/22/23 with links. MKT-22 is flagged overdue.
4. **Demo 2, ownership (30s):** On MKT-21, open the Teamwork Insight issue panel and ask Rovo "Who is involved in this issue?". You get the owner (assignee), the reporter, discussion participants (explicitly *not* owners), and the team linked to the project.
5. **Demo 3, team workload (45s):** Ask "What is my team working on?". If you are in two teams, the agent asks which one. The answer covers per-member counts, Alice flagged as high load, top priorities, and the disclaimer. Show the same view on the dashboard as bars.
6. **Demo 4, related context (30s):** Ask "Are there any related issues or documents for MKT-22?". The answer shows it is blocked by MKT-21 and MKT-30, related to MKT-23, child of MKT-1, plus the linked launch plan and the Confluence matches labelled "possibly related".
7. **Demo 5, reusability and MCP (25s):** In Rovo Studio, add the "Teamwork Insight" tools to a new custom agent and call `find-blocked-work`. Optionally show an external MCP client hitting `https://mcp.atlassian.com/forge/<appId>`.
8. **Wrap-up (15s):** "Forge-only, $0 hosting within the free tier, permission-aware via asUser, grounded answers with sources. Built on Rovo, Teamwork Graph and MCP."

## Codegeist submission checklist

- [ ] Category: Apps for Software Teams
- [ ] Bonus: Rovo agent (`rovo:agent` + 6 actions). Evidence: manifest, demo steps 3–6.
- [ ] Bonus: Teamwork Graph. Evidence: `src/services/teamworkGraph/*`, 5 curated queries, dashboard status, source badges.
- [ ] Bonus: Atlassian MCP. Evidence: the `rovo:mcp` module exposing all 6 actions, demo step 7. Claim this only after it is verified live.
- [ ] Installation link (production distribution) plus judge instructions: org-admin install, Rovo enabled.
- [ ] Public GitHub repository (MIT)
- [ ] Demo video under 5 minutes, recorded on live data
- [ ] Screenshots added to the README
