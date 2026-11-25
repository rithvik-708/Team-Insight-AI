# Proposed Project: “Teamwork Insight AI Assistant” 

We propose **Teamwork Insight**, an AI-powered Forge app for *Software Teams* that delivers rich organizational context inside Jira. Using Atlassian’s Teamwork Graph and Rovo AI, it answers questions like “What am I working on?”, “What is my team working on?”, or “Who’s involved in this issue?”. By surfacing relevant knowledge (e.g. linked tasks, owners, status) at the right moment, it cuts down context-switching and helps teams “ship with confidence”. This directly targets real pain points (duplicated work, unclear ownership, hidden docs) that Codegeist winners have successfully addressed. 

- **Target user:** A project manager or developer needing cross-team visibility.  
- **Pain point:** Important context (related tickets, owners, documentation) is scattered across Jira and Confluence. Team members waste time tracking it down or duplicating work.  
- **Solution summary:** A Rovo chatbot (Forge app) in Jira. Users type questions in plain language. Under the hood, the agent runs GraphQL queries on Teamwork Graph (and Jira/Confluence APIs) to gather relevant items, then replies via Rovo with an organized answer. For example, “what are the top issues I’m assigned” or “show my team’s workload” yields a summary of tickets and statuses, and “who else is working on this feature” yields collaborators and linked tasks. The app will optionally expose some actions via **rovo:mcp** so our tools can be added to other AI clients (qualifying for the MCP prize).  

## Differentiation & Innovation  
Unlike existing AI “copilot” Jira apps (which focus on content generation or requirements writing), Teamwork Insight emphasizes *contextual collaboration*. It leverages Atlassian’s Teamwork Graph – a unified knowledge graph of users, teams, work items, goals, and Confluence pages – to provide actionable insights. By combining this with Rovo, the app offers a conversational interface that truly “connects work across silos”. Previous Codegeist winners stressed simplicity and direct problem-solving; our MVP follows that lesson by focusing on a clear use-case (team context queries) rather than a broad AI toy. In short, we address a *real, concrete problem* (context fragmentation) with Atlassian-native tools.   

## Architecture & Modules  

- **Forge App (Node.js 22, Atlaskit UI):** The app runs entirely on Atlassian Forge (no external servers). We’ll use Forge UI Kit (open-source React components) or the standard Rovo interface for any UI, ensuring zero hosting cost. All compute/storage is in Forge’s free tier.  

- **Rovo Agent (`rovo:agent`):** Defines the conversational interface. The manifest will include one `rovo:agent` module (e.g. “Context Guide”) with a natural-language prompt and a set of conversation starters (“What am I working on?”, “Who’s involved in this ticket?”, “What is the Platform team working on?”). The agent’s prompt will instruct it to use our custom actions to fetch data, then format a concise answer.  

- **Actions (`action` modules):** We implement ~2–3 Forge functions as Rovo actions. For example:  
  - `myWorkSummary`: Input = (optional) username. Calls **Teamwork Graph** via `api.asUser().requestTeamworkGraph()` using the curated query `atlassianUserAssignedJiraWorkItems(userId: …)`. It gathers the current user’s open issues, filters/sorts them, and returns a summary (issue keys, titles, statuses).  
  - `teamWorkload`: Input = (optional) team name. If blank, it first queries the Graph for the current user’s teams (`atlassianUserInTeams`). Takes one team ARI and calls `atlassianTeamMembers(teamAri: …)` to get team members, then calls `atlassianUserAssignedJiraWorkItems` for each member. The function aggregates the count of issues per user (and maybe top titles) and returns a team workload report.  
  - (Optional) `issuePeople`: Input = a Jira issue key. Uses Jira REST API (`api.asUser().requestJira`) or GraphQL (`jiraWorkItemComments`) to list assignee, reporter, commenters, watchers, etc. This action answers “who’s involved in X” queries.  

- **Teamwork Graph Integration:** We will use the Forge `requestTeamworkGraph` API to call curated GraphQL queries. Each query requires specific scopes (e.g. `read:graph:issue:jira`, `read:graph:team:atlassian`, etc.) in the manifest. The preview GraphQL endpoint is free to query (no separate pricing). Using Graph ensures answers are permission-filtered for the user and up-to-date.  

- **Forge Manifest:** Our `manifest.yml` will include:  
  - The `rovo:agent` module with conversation starters.  
  - `action` modules for each function (with HTTP verb GET for queries).  
  - **(Bonus)** a `rovo:mcp` module that exposes one or more of our actions as “tools” for Rovo agents (fulfilling the MCP bonus prize). For example, exposing `myWorkSummary` as a tool named “ListMyTasks”. This costs nothing extra to run on Forge.  
  - Required **scopes**: At least `read:jira-work`, `read:jira-user`, and `read:graph:*` for needed object types (issues, teams, users, comments, etc.).  

- **Open-Source Stack:** The app’s code (Node.js, libraries) will be open-sourced (e.g. on GitHub). We’ll use Atlassian’s open-source UI Kit for any forms or panels (though the MVP is mostly chat-based). No proprietary or paid libraries are needed – Forge and Rovo SDKs are freely available, and any additional Node modules (e.g. for formatting) will be OSS.  

## Cost and Hosting

The entire solution can run in Atlassian’s cloud **at virtually no cost** to us. Forge apps have generous free quotas, and our usage (a few GraphQL calls and lightweight processing per chat) will remain well within them. For example, Forge allows 200,000 GB-seconds of compute per app per month at no charge; our functions will consume only a tiny fraction of that. Storage and logs are similarly generous. Crucially, **Rovo usage is billed to the customer, not to the developer**: every Jira/Confluence paid plan includes pooled Rovo credits and usage is charged against the organization’s subscription. Thus we bear no AI hosting costs. Even if we occasionally use Forge’s LLM APIs or container features, minimal use should fall under free tiers. We will document assumed usage and emphasize caching/reuse (e.g. only querying the Graph on demand) to stay free. In short, **hosting cost ≈ $0** (verified by Forge pricing docs).  

## Milestones (1–2 person schedule)

1. **Week 1 – Setup & Scoping:** Register Forge dev site; install required preview features (Teamwork Graph, Rovo) on a Jira Cloud trial. Define data model (Jira project, example tickets). Code a barebones Forge app with manifest and simple “echo” function to test Graph connectivity.  
2. **Week 2 – Graph Queries:** Implement and test GraphQL queries in isolation. Write a Forge function to call `atlassianUserAssignedJiraWorkItems` for a known user, parse the JSON, and log results. Refine manifest scopes (e.g. `read:graph:user:atlassian`, `read:graph:issue:jira`). Verify results in logs.  
3. **Week 3 – Rovo Actions:** Add Rovo Agent to manifest with actions. Implement `myWorkSummary` action: fetch current user’s accountId via Jira API, convert to ARI, call Graph query, and format text. Do the same for `teamWorkload` (find team, loop users). Write a straightforward prompt (using variables from actions) and test a basic chat in Jira.  
4. **Week 4 – Confluence Integration (Optional):** If time allows, add a “related docs” action that searches Confluence (via REST API) for keywords from an issue and lists relevant pages. Otherwise, prioritize stability and error handling.  
5. **Week 5 – Polish & Testing:** Handle edge cases (no team, no tasks). Improve agent prompt for clarity. Ensure app works end-to-end with a demo dataset. Create a Forge sandbox or Developer Site and package an installable link (for judges).  
6. **Final Week – Demo Video & Submission:** Write documentation and Devpost answers. Record a 5-minute demo (script below). Submit on Devpost before deadline.  

## Risks & Mitigations 

- **Permission Scopes & Admin Setup:** Teamwork Graph and Rovo require specific org-level enablement (Graph preview, Rovo on). *Mitigation:* Use an Atlassian Cloud instance under our control (trial Premium or Enterprise) to enable all preview features early. Document any special setup for judges.  
- **Graph Data Availability:** In a real org, the Graph depends on connectors (only Jira/Confluence built-in, and any third-party). Our demo may have limited data. *Mitigation:* Create realistic sample Jira projects and Confluence pages ahead of time. Also, handle “no data” gracefully (agent says “I don’t have info”).  
- **Rovo Prompt Reliability:** Generative output can be unpredictable. *Mitigation:* Keep prompts constrained (e.g. “List each task on a new line”). Use actions to do logic instead of relying on LLM (“The agent should only format the given data.”). Verify prompt compliance.  
- **Forge Quotas:** Unlikely to hit them with one user, but if scale testing, guard against expensive queries. *Mitigation:* If needed, paginate queries or limit returned items to keep function time low. Monitor usage in dev space.  

## Judging Strategy 

- **Tech Implementation (20%)**: We will demonstrate a *genuine working solution*, not a stub. By submission, the app will be installed on a test Jira site with actual issues. Judges can chat with the Rovo agent and see real data. We’ll showcase multiple queries and include our manifest / code on GitHub (via Devpost). The design uses standard Forge modules (rovo:agent, action, requestTeamworkGraph) meaning it’s non-trivial code, not a “hardcoded demo”.  
- **Design (20%)**: The user experience is seamless: an in-context chat within Jira, using Atlassian’s UI for chat, so no new learning curve. The information is presented cleanly as bullet points or short answers. We’ll lean on Forge UI Kit styling if any custom UI is built (e.g. a sidebar). Simplicity is key (past winners emphasized clarity over clutter).  
- **Impact (20%)**: We will clearly articulate a real use-case (e.g. sprint planning or issue handover) in the pitch: teams lose hours when context is hidden, so this app **directly saves time and reduces errors**. We’ll illustrate that with example data (e.g. an issue that references a Confluence spec, which the agent surfaces). The app’s value proposition (reduce context-switching) will be explicit in the video.  
- **Innovation (20%)**: The novelty is combining Atlassian’s *context graph* with AI. Many tools “write Jira tasks”, but few link the *entire org’s memory* to a helpful agent. Using Teamwork Graph and Rovo together is cutting-edge (we’ll cite Atlassian blogs that hype this angle). Exposing one action via `rovo:mcp` (preview feature) also shows forward-thinking. We’ll call out “forge+Graph+AI” as a fresh idea.  
- **Presentation (20%)**: Our <5min demo video will be structured and high-quality: introduce the problem, show the app in action (with a clear narrated script), and end with a summary of next steps. We’ll highlight ease-of-use (“just chat”) and results clearly. All required submission elements (install link, category, bonus entries) will be explicitly provided.  

## Demo Script (approx. 4 min) 

- **Intro (20s):** Quick on-screen: “Meet Teamwork Insight – a Jira AI assistant built on Forge. It uses your org’s context (via Teamwork Graph) to answer questions about work items.” (Show slide/title, Atlassian logo, etc.)  

- **Scenario Setup (30s):** In a Jira backlog or issue view, show sample project “MarketingSite”. Show a couple of open issues assigned to *you* and teammates. Optionally show Confluence page “Launch Plan”. Narration: “Our demo project has multiple issues (Design, Develop, QA) and teams involved.”  

- **Question 1 – “What am I working on?” (45s):** In the issue view, open the Rovo chat pane (via a button or automatically). Type: “What am I working on?”. The agent triggers the `myWorkSummary` action, queries Graph for your assigned tickets, and returns:  
  ```
  • MKT-21: “Design landing page” – In Progress  
  • MKT-22: “Implement signup form” – To Do  
  • MKT-23: “Write unit tests” – In Progress  
  ```  
  Highlight that it shows *key*, title, and status. Narration: “It listed my top open issues across projects, saving me from opening each board.”  

- **Question 2 – “Who’s on this?” (30s):** Click on issue MKT-21 (Design). Ask “Who is involved in this issue?”. The agent uses `issuePeople` (via Jira REST or Graph) to fetch the assignee, reporter, recent commenters. It replies:  
  ```
  Assignee: Alice Doe  
  Reporter: You  
  Recent commenters: Bob (Dev), Carol (QA)  
  Teams: MarketingTeam (team handling this project)  
  ```  
  Point out that it identifies the key people and team, so you know whom to contact.  

- **Question 3 – “What is my team working on?” (45s):** Ask: “What is my team working on?”. The agent’s `teamWorkload` action finds your first team (MarketingTeam), lists team members and their task counts:  
  ```
  *Alice (Design) – 5 tasks  
  *Bob (Dev) – 3 tasks  
  *Carol (QA) – 4 tasks  
  Total: 12 open issues  
  ```  
  It may also show titles of top tasks or project names. Highlight that this reveals the overall picture of the team’s workload without toggling between Jira filters.  

- **Optional Additional Query (30s):** If time permits, show a more open query: e.g. “Are there any linked documents for this project?” The agent could respond (using Confluence or Graph if implemented) with page titles. If Confluence wasn’t built, instead ask “What related issues exist?” and show Graph finding linked dependencies or epics.  

- **Wrap-up (15s):** Show a quick slide or text: “Built on Forge, Rovo, and Teamwork Graph, Teamwork Insight helps teams collaborate with full context. The app is zero-cost to host (all on Forge’s free tier). We plan to publish it to Atlassian Marketplace (bonus prize) and enable MCP tools (bonus prize). Now let’s get your teams moving faster with confidence.”  

Throughout the video, overlay brief labels or annotations highlighting features (e.g. “Rovo chat”, “GraphQL query under the hood”). Ensure any Atlassian logos or product UIs are clearly visible. Provide the judges with an install link and instructions (via Devpost) so they can test it themselves. All claims (free hosting, use of Forge APIs, etc.) are supported by Atlassian documentation as cited. 

**Sources:** The approach is directly aligned with the official Codegeist brief. We verified Forge’s free tier (200k GB-s, generous storage) as of 2026 and note Rovo costs are borne by end-users. Our plan addresses each judging criterion and uses Atlassian’s latest AI/Graph platform (as detailed in their docs) for maximum impact and bonus-prize eligibility.