# MASTER BUILD INSTRUCTIONS — TEAMWORK INSIGHT
## Autonomous Engineering Specification for Claude Code

You are the lead software architect, senior full-stack engineer, Atlassian Forge specialist, AI engineer, UI/UX designer, QA engineer, and DevOps engineer responsible for building this project.

Your task is to transform the project described in `Project-Report.md` into a complete, functional, polished, installable Atlassian Forge application.

You must take ownership of the implementation, make sensible engineering decisions, write actual working code, test it, fix errors, and document the result.

Do not stop after producing an architecture, implementation plan, or sample code. Your objective is a working application.

---

# 1. SOURCE OF TRUTH AND PROJECT UNDERSTANDING

Before writing any code, thoroughly read:

`Project-Report.md`

This document is the primary product specification. It describes the proposed project, target audience, problem, architecture, integrations, features, technology choices, cost constraints, judging strategy, and expected demonstration.

You MUST use both:
- `prompt.md` — implementation instructions and engineering requirements.
- `Project-Report.md` — product vision, functional requirements, and original project proposal.

Treat the report as the source of product intent.

If a technical implementation detail in the report is outdated, inaccurate, unsupported, or incompatible with the current Atlassian platform:

1. Identify the issue.
2. Consult current official Atlassian documentation.
3. Determine the supported implementation.
4. Preserve the original product functionality wherever possible.
5. Document any necessary deviation.

Never invent API methods, Forge modules, GraphQL fields, permission scopes, configuration options, or SDK functionality.

Official documentation should take priority over assumptions in either document.

Useful documentation:

- Forge: https://developer.atlassian.com/platform/forge/
- Forge CLI: https://developer.atlassian.com/platform/forge/cli-reference/
- Rovo: https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-agent/
- Teamwork Graph: https://developer.atlassian.com/platform/teamwork-graph/
- Forge Teamwork Graph API: https://developer.atlassian.com/platform/forge/call-the-teamwork-graph-api/
- Atlassian REST APIs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- Confluence REST APIs: https://developer.atlassian.com/cloud/confluence/rest/v2/
- Atlassian Design System: https://atlassian.design/

Do not assume every preview feature is enabled on every Atlassian developer site.

---

# 2. PRODUCT VISION

## Product name

Teamwork Insight

## Product description

Teamwork Insight is an AI-powered organizational context assistant built on Atlassian Forge.

It helps software teams understand their organization's work without manually navigating multiple Jira projects, issues, teams, and Confluence documents.

It combines:
- Atlassian Forge.
- Jira Cloud.
- Atlassian Teamwork Graph.
- Atlassian Rovo.
- Confluence (where supported and enabled).
- Reusable AI actions.
- Optional Atlassian MCP integration.

The fundamental idea:

AI can generate answers, but useful answers require organizational context.

Teamwork Insight retrieves the right organizational information, connects relevant entities, identifies relationships, and presents actionable insights to users.

## Target audience

- Software developers.
- Engineering managers.
- Project managers.
- Scrum masters.
- Technical leads.
- Cross-functional software teams.

## Core problem

Information is distributed across:
- Jira issues.
- Jira projects.
- Team members.
- Issue assignments.
- Linked issues.
- Comments.
- Confluence documentation.
- Teamwork Graph relationships.

People waste time finding out:
- What they are working on.
- What their teammates are working on.
- Who owns a particular issue.
- Which issues are related.
- Which people are involved in a feature.
- What organizational context is relevant to a decision.

Teamwork Insight should eliminate this unnecessary context switching.

---

# 3. ENGINEERING PRINCIPLES

Follow these principles throughout development.

1. Build a genuine application, not a UI mockup.
2. Prioritize functional integrations over decorative features.
3. Use official Atlassian APIs and supported Forge capabilities.
4. Prefer open-source dependencies.
5. Minimize external infrastructure and recurring costs.
6. Keep all sensitive operations server-side.
7. Respect Atlassian permissions and user authorization.
8. Never expose credentials or secrets in frontend code.
9. Implement robust error handling.
10. Write maintainable, modular, documented code.
11. Design the experience for actual developers and engineering teams.
12. Make the application demonstrable using real Jira data.
13. Avoid unnecessary complexity and premature abstractions.
14. Do not use paid external AI APIs as a mandatory dependency.
15. Do not introduce external hosting unless a technically necessary capability cannot be implemented using Forge.

The application should run primarily within Atlassian Forge infrastructure.

Do not introduce Firebase, Supabase, AWS, Vercel, paid databases, or external backend services unless absolutely necessary and explicitly justified.

---

# 4. REQUIRED TECHNOLOGY STACK

Use the following stack, subject to compatibility verification against the current Forge platform.

## Backend

- Node.js 22 where supported by the selected Forge runtime.
- JavaScript or TypeScript.
- Atlassian Forge SDK.
- `@forge/api`.
- Forge functions.
- Forge resolver APIs where appropriate.
- Forge-hosted storage only where persistence is needed.

Prefer TypeScript for application logic if the current Forge tooling supports it cleanly.

## Frontend

- React, using the supported Forge UI approach.
- Atlassian Forge Custom UI or UI Kit.
- Atlassian Design System / Atlaskit where compatible.
- CSS or a lightweight styling system.
- Lucide icons if compatible with the frontend environment.

Choose the frontend approach that offers the best balance of visual quality, Forge compatibility, and development simplicity.

Do not assume that arbitrary React applications can run inside Forge without the appropriate Custom UI configuration.

## Integrations

- Jira REST API.
- Teamwork Graph API.
- Rovo agent and action modules.
- Confluence REST API (optional enhancement).
- Atlassian MCP capability if officially supported by the current Forge environment.

## Development tools

- Forge CLI.
- Git.
- npm.
- ESLint.
- Prettier.
- TypeScript where appropriate.
- Jest or another compatible testing framework.

Avoid unnecessary dependencies.

Before installing a dependency, consider whether the functionality can be implemented using existing platform capabilities.

---

# 5. REQUIRED FEATURES

Implement features in priority order.

## FEATURE 1: Rovo AI Assistant

This is the central feature.

Create a Rovo agent called:

**Teamwork Insight – Context Guide**

The agent must understand natural-language questions and use the application's actions to retrieve actual organizational information.

Suggested conversation starters:

- What am I working on?
- What is my team working on?
- Who is involved in this issue?
- Show my outstanding work.
- Which issues are blocked?
- What are the related issues for this feature?
- Give me an overview of my team's workload.
- What should I focus on next?

The agent must:

1. Understand the user's question.
2. Identify the appropriate action.
3. Invoke the action.
4. Interpret the structured result.
5. Present a concise, useful answer.
6. Include links to relevant Jira issues or Confluence pages when available.
7. Explicitly communicate when information is unavailable.

Never allow the LLM to fabricate Jira issues, users, statuses, relationships, or organizational information.

The agent must distinguish actual retrieved facts from recommendations or inferences.

Use deterministic backend logic for calculations, filtering, sorting, and aggregation. Let Rovo handle natural-language interaction and explanation.

## FEATURE 2: My Work Summary

Implement a reusable action:

`myWorkSummary`

Purpose:

Retrieve the authenticated user's assigned Jira work items through Teamwork Graph.

Expected functionality:

- Identify the current authenticated user.
- Retrieve assigned Jira work items.
- Return issue key.
- Return issue summary.
- Return status.
- Return priority when available.
- Return project information when available.
- Identify overdue work when dates are available.
- Filter out completed issues by default.
- Sort by priority and relevance.
- Limit the response to a reasonable number of issues.
- Support pagination where required.

Example question:

"What am I working on?"

Example response:

YOUR CURRENT WORK

1. MKT-21 — Design landing page
   Status: In Progress
   Priority: High

2. MKT-22 — Implement signup form
   Status: To Do
   Priority: Medium

3. MKT-23 — Write unit tests
   Status: In Progress
   Priority: High

The example data is illustrative. All actual responses must come from live API results.

## FEATURE 3: Team Workload

Implement:

`teamWorkload`

Purpose:

Provide visibility into the workload of the user's team.

Expected functionality:

- Identify the current user's team when supported.
- Allow selection of a team when appropriate.
- Retrieve team members.
- Retrieve assigned work for each member.
- Aggregate open issue counts.
- Identify members with unusually high workloads.
- Identify members with no assigned work.
- Show status distribution.
- Show the highest-priority outstanding tasks.
- Present a team-level summary.

Example:

TEAM WORKLOAD

Alice — 5 open issues
Bob — 3 open issues
Carol — 4 open issues

Total: 12 open issues.

Make it clear that task counts are indicators of assigned work, not necessarily precise measures of individual capacity.

Do not invent teams or team memberships.

If the Teamwork Graph cannot provide a required relationship, investigate supported alternatives using Jira APIs.

Handle missing team information gracefully.

Do not assume that a user's first team is always the correct team.

## FEATURE 4: Issue People and Context

Implement:

`issuePeople`

Purpose:

Help users understand who is involved in a particular Jira issue.

Retrieve available information such as:

- Issue assignee.
- Reporter.
- Relevant commenters.
- Issue watchers, if accessible.
- Related team information, if supported.
- Linked Jira issues.
- Relevant project information.

The response should answer:

- Who owns this issue?
- Who reported it?
- Who has participated in the discussion?
- Which related work items exist?
- Which people should I contact?

Respect access permissions and avoid exposing information unavailable to the requesting user.

Do not imply that a person is responsible for an issue merely because they commented on it.

## FEATURE 5: Related Work and Dependencies

Implement a contextual lookup capability.

Help users identify:
- Linked Jira issues.
- Related work items.
- Parent and child issues.
- Dependencies.
- Blocked work.
- Relevant projects.

Use Teamwork Graph curated queries when supported and appropriate.

Where Graph data is unavailable, use supported Jira REST endpoints as a fallback.

Make the source of each result clear.

## FEATURE 6: Related Documentation (Phase 2)

Implement an optional Confluence integration.

The user should be able to ask:

"Are there any documents related to this feature?"

The application should:

- Search accessible Confluence pages.
- Identify relevant documentation.
- Return page titles.
- Return short descriptions where available.
- Provide links.
- Identify relevant documentation associated with a project or issue.

Do not implement this at the expense of the stability of the core Jira and Teamwork Graph functionality.

---

# 6. TEAMWORK GRAPH INTEGRATION

This is one of the most important parts of the project.

We need genuine Teamwork Graph integration, not merely Jira REST API calls presented as graph functionality.

Use the official Forge Teamwork Graph request mechanism, subject to current documentation.

Investigate the supported API signature for:

`api.asUser().requestTeamworkGraph(...)`

Use curated GraphQL queries.

The project report identifies potential queries such as:

- `atlassianUserAssignedJiraWorkItems`
- `atlassianUserInTeams`
- `atlassianTeamMembers`
- `jiraWorkItemComments`

Verify the current availability, exact names, arguments, returned fields, and limitations of each query before using it.

Do not assume that every example query exists in the current API.

For each query:

1. Confirm it exists in official documentation.
2. Confirm required arguments.
3. Confirm the returned schema.
4. Identify required permission scopes.
5. Implement the query.
6. Handle null and empty responses.
7. Handle pagination and result limits.
8. Test against a real developer site.

Create a dedicated Teamwork Graph service layer.

Suggested structure:

`src/services/teamworkGraph/`

Separate:
- Graph client.
- Query definitions.
- Response parsing.
- User lookup.
- Team lookup.
- Issue lookup.

Keep GraphQL queries out of UI components.

Use authenticated user context wherever supported.

Never bypass Atlassian permissions.

Important: Teamwork Graph is a central differentiator and potential Codegeist bonus category. Implement and demonstrate actual API consumption.

---

# 7. ROVO AGENT AND REUSABLE ACTIONS

Implement the Rovo agent using the officially supported Forge module definitions.

Investigate the current syntax for:

- `rovo:agent`
- `action` or the currently documented Rovo action module.
- Any relevant reusable action or skill modules.

The agent should expose the actions:

1. myWorkSummary
2. teamWorkload
3. issuePeople
4. relatedWork

Each action must have:

- A meaningful name.
- A clear description.
- A documented input schema.
- A documented output structure.
- Input validation.
- Error handling.
- Appropriate authentication.
- A short and focused responsibility.

Actions should be independently reusable wherever possible.

Avoid putting all business logic inside one giant function.

Create a centralized action implementation layer.

The agent's instructions must emphasize:

- Always retrieve live data through actions.
- Never invent organizational information.
- Clearly distinguish retrieved facts from suggestions.
- Cite issue keys and provide links.
- Explain missing information.
- Use concise formatting.
- Avoid exposing sensitive data.
- Ask a clarifying question when a request cannot be safely resolved.

---

# 8. ATLASSIAN MCP BONUS INTEGRATION

Investigate the official Forge MCP support and the Codegeist eligibility requirements.

The objective is to qualify for:

**Best app with Atlassian MCP**

If the currently supported Forge module is `rovo:mcp`, investigate and implement it using the official manifest schema.

Expose useful capabilities as MCP tools where supported.

Potential tools:

- get_my_work
- get_team_workload
- get_issue_people
- find_related_work

Requirements:

1. Expose actual working tools.
2. Give each tool a useful description.
3. Define proper input schemas.
4. Reuse the existing business logic.
5. Enforce permission boundaries.
6. Return structured results.
7. Test the MCP integration.
8. Document how judges can access and test it.

Do not build an unrelated standalone MCP server merely to claim MCP eligibility.

If the required Forge MCP capability is unavailable, document the limitation and identify the most appropriate supported alternative.

Never claim eligibility for a bonus category without implementing the corresponding functionality.

---

# 9. USER INTERFACE AND DESIGN

The application must look like a polished Atlassian-native developer product.

Avoid a generic chatbot template.

Design a professional experience with a clear visual hierarchy.

## Main interface

Suggested product layout:

### Header

- Teamwork Insight logo/icon.
- Product name.
- Short description.
- Connection or integration status.

### Main dashboard

Show useful information:

- My Open Issues.
- High Priority Issues.
- Overdue Issues.
- Team Open Issues.
- Workload Overview.

### AI Assistant

A conversational interface with:

- Message history.
- Text input.
- Send button.
- Loading indicator.
- Suggested questions.
- Error feedback.
- Clear action results.

### Context Cards

When relevant, display:

- Jira issue key.
- Issue title.
- Status.
- Priority.
- Assignee.
- Project.
- Direct Jira link.

### Team Overview

Show:
- Team members.
- Assigned work counts.
- Work distribution.
- High-priority work.
- Workload observations.

Use charts only where they genuinely improve understanding.

## Visual design requirements

- Clean, modern interface.
- Atlassian-inspired design language.
- Responsive layout.
- Consistent spacing.
- Clear typography.
- Accessible contrast.
- Proper loading and empty states.
- Useful error states.
- No unnecessary visual clutter.

Avoid excessive gradients, oversized cards, unnecessary animations, and generic AI-themed decorations.

The interface should feel like a real productivity application that developers would use daily.

All UI must work within the selected Forge module and supported runtime.

---

# 10. APPLICATION ARCHITECTURE

Use a modular architecture.

Suggested project structure:

```text
teamwork-insight/
│
├── Project-Report.md
├── prompt.md
├── README.md
├── package.json
├── manifest.yml
├── tsconfig.json
├── eslint.config.js
│
├── src/
│   ├── index.ts
│   │
│   ├── actions/
│   │   ├── myWorkSummary.ts
│   │   ├── teamWorkload.ts
│   │   ├── issuePeople.ts
│   │   └── relatedWork.ts
│   │
│   ├── agents/
│   │   └── contextGuide.ts
│   │
│   ├── services/
│   │   ├── jira/
│   │   │   ├── client.ts
│   │   │   └── issues.ts
│   │   │
│   │   ├── teamworkGraph/
│   │   │   ├── client.ts
│   │   │   ├── queries.ts
│   │   │   ├── users.ts
│   │   │   ├── teams.ts
│   │   │   └── workItems.ts
│   │   │
│   │   └── confluence/
│   │       └── search.ts
│   │
│   ├── utils/
│   │   ├── errors.ts
│   │   ├── validation.ts
│   │   ├── formatting.ts
│   │   └── logging.ts
│   │
│   └── types/
│       ├── jira.ts
│       ├── teamworkGraph.ts
│       └── actions.ts
│
├── static/
│   └── dashboard/
│       ├── package.json
│       ├── index.html
│       └── src/
│           ├── App.tsx
│           ├── components/
│           ├── pages/
│           ├── hooks/
│           ├── services/
│           └── styles/
│
├── tests/
│   ├── actions/
│   ├── services/
│   └── utils/
│
└── docs/
    ├── ARCHITECTURE.md
    ├── API-INTEGRATION.md
    ├── SETUP.md
    ├── TESTING.md
    └── DEPLOYMENT.md
```

This is a suggested structure, not a rigid requirement.

Adapt it to the actual Forge application scaffolding and module structure.

Do not create unnecessary files or duplicate configuration.

Maintain clear boundaries between:
- UI.
- Business logic.
- Forge handlers.
- Atlassian integrations.
- Data validation.
- Shared types.

---

# 11. SECURITY AND PERMISSIONS

Security is mandatory.

Implement:

- Least-privilege scopes.
- Authenticated user context.
- Server-side API access.
- Input validation.
- Safe error handling.
- No hardcoded credentials.
- No sensitive information in frontend bundles.
- No unnecessary storage of personal or organizational data.

Use Forge permission scopes based on the actual APIs and modules implemented.

Do not use broad wildcard permissions when narrower scopes are available.

Review the final manifest for unnecessary scopes.

Do not use administrator credentials or a shared service account to retrieve information on behalf of users unless the architecture explicitly and safely requires it.

All data returned by the application must respect the permissions of the requesting user.

Treat Teamwork Graph and Jira results as user-authorized information.

---

# 12. COST AND OPEN-SOURCE REQUIREMENTS

The primary deployment environment must be Atlassian Forge.

Our hosting budget target is:

**$0 per month for the MVP, or as close to zero as realistically possible.**

Use:

- Forge free usage allowances where applicable.
- Open-source npm dependencies.
- GitHub for source control.
- Free development tooling.
- Forge-hosted compute.
- Forge storage only where necessary.

Avoid:
- Paid LLM API requirements.
- Paid external database services.
- Paid backend hosting.
- Paid analytics platforms.
- Paid vector databases.
- Paid monitoring platforms.

Do not assume that all Forge capabilities are permanently free.

Verify current usage allowances and billing conditions.

Document:
- Forge hosting assumptions.
- Usage limits.
- Rovo licensing and customer-side requirements.
- Any paid capabilities.
- Optional external costs.
- How to operate within free allowances.

The application must remain useful without a separately billed external AI API.

Rovo is the primary AI interface.

---

# 13. ERROR HANDLING AND RESILIENCE

The application must gracefully handle:

- No assigned Jira issues.
- User not belonging to a team.
- Missing team membership.
- Empty Teamwork Graph responses.
- Unsupported GraphQL queries.
- Permission denied.
- Missing scopes.
- Jira API failures.
- Confluence unavailable.
- Invalid issue keys.
- Missing issue details.
- API rate limits.
- Timeouts.
- Unexpected response structures.
- Rovo action failures.

Provide useful user-facing messages.

Never expose raw stack traces, credentials, access tokens, or sensitive internal errors to end users.

Log diagnostic information without logging sensitive personal data.

Implement appropriate timeouts and pagination.

Do not retry non-idempotent operations blindly.

---

# 14. TESTING REQUIREMENTS

Create meaningful tests.

## Unit tests

Test:
- Issue formatting.
- Status filtering.
- Priority sorting.
- Workload aggregation.
- Input validation.
- Response parsing.
- Empty data handling.
- Error handling.

## Integration tests

Test the integration layer using mocked Atlassian responses where appropriate.

Verify:
- GraphQL query construction.
- Jira REST requests.
- User identity handling.
- Permission error handling.
- Action response formatting.

## Live testing

Where credentials and an Atlassian developer site are available:

- Deploy the development app.
- Install it on the test site.
- Test actual Jira data retrieval.
- Test the Rovo agent.
- Test every implemented action.
- Test Teamwork Graph integration.
- Test permission boundaries.
- Test MCP functionality if implemented.

Do not pretend mocked tests prove that live Atlassian integrations work.

Clearly separate:
- Unit-tested.
- Mock integration-tested.
- Live integration-tested.

---

# 15. DEVELOPMENT EXECUTION PLAN

Build this project in controlled phases.

Do not attempt to build everything simultaneously.

## PHASE 0 — Repository Inspection

Before changing anything:

1. Inspect the current working directory.
2. Read `Project-Report.md`.
3. Read `prompt.md`.
4. Inspect existing files.
5. Inspect package configuration.
6. Identify existing application scaffolding.
7. Identify available Forge CLI tools.
8. Identify existing Git changes.

Never overwrite useful existing code without understanding it.

Do not replace an existing working repository with a new scaffold unnecessarily.

Create a concise implementation checklist.

## PHASE 1 — Forge Foundation

Implement:

- Forge application scaffold.
- Correct manifest.
- Supported runtime.
- Basic app entry point.
- Minimal working frontend.
- Basic backend function.
- Initial permission scopes.

Run:
- Dependency installation.
- Linting.
- Type checking.
- Build validation.
- Forge manifest validation.

The app must reach a deployable baseline.

## PHASE 2 — Jira Integration

Implement:
- Current user identification.
- Assigned work retrieval.
- Issue details.
- Issue status.
- Issue links.

Test against real Jira data if possible.

## PHASE 3 — Teamwork Graph

Implement:
- Graph client.
- Verified curated queries.
- User work retrieval.
- Team discovery.
- Team member lookup.
- Related organizational context.

Test every Graph query.

Document any unavailable capabilities.

## PHASE 4 — Rovo Agent

Implement:
- Context Guide agent.
- Agent instructions.
- Conversation starters.
- Reusable actions.
- Input and output schemas.
- Agent error handling.

Test natural-language interactions.

## PHASE 5 — Teamwork Insight Dashboard

Implement:
- Main dashboard.
- Work summary.
- Team workload.
- Context cards.
- Conversational interface.
- Suggested questions.
- Loading states.
- Empty states.
- Error states.

Ensure all displayed information comes from real backend responses.

## PHASE 6 — Additional Integrations

Prioritize:
1. Related issue context.
2. Issue people.
3. Confluence documentation.
4. MCP integration.

Implement only supported functionality.

## PHASE 7 — Quality and Security

Perform:
- Testing.
- Manifest review.
- Permission review.
- UI refinement.
- Error handling.
- Performance review.
- Documentation.

Fix all critical errors before proceeding.

## PHASE 8 — Deployment and Demo

Prepare:
- Forge deployment instructions.
- Installation instructions.
- Test environment.
- Demo dataset.
- GitHub-ready repository.
- Public documentation.
- Demo video script.
- Codegeist submission materials.

---

# 16. CODE QUALITY EXPECTATIONS

Write production-minded code.

Every important module should have a clear responsibility.

Avoid:
- Giant files.
- Giant functions.
- Duplicate logic.
- Hardcoded demo responses.
- Placeholder integrations.
- Fake API responses in production paths.
- Unnecessary abstractions.
- Dead code.
- Unused dependencies.
- Swallowed exceptions.
- Excessive comments that repeat the code.

Use meaningful names.

Use structured types.

Keep API response parsing defensive.

Add comments for non-obvious platform behavior and architectural decisions.

Use consistent formatting.

Do not leave TODO comments for core functionality.

If an optional feature cannot be implemented, document it explicitly rather than pretending it works.

---

# 17. CODEGEIST JUDGING OPTIMIZATION

The application will be judged equally across five categories:

- Technological Implementation — 20%.
- Design — 20%.
- Potential Impact — 20%.
- Innovation/Idea — 20%.
- Presentation — 20%.

Optimize the application for all five.

## Technological Implementation

Demonstrate genuine:
- Forge functionality.
- Rovo integration.
- Teamwork Graph API usage.
- Live Jira data retrieval.
- Reusable actions.
- Secure authorization.
- Error handling.

## Design

Deliver a coherent product experience.

The application must feel complete rather than like a basic proof of concept.

## Potential Impact

Demonstrate how the application reduces:
- Context switching.
- Time spent searching for information.
- Unclear ownership.
- Duplicated work.
- Team coordination friction.

Use a realistic software-team workflow.

## Innovation

Highlight the combination of:
- Teamwork Graph.
- Rovo.
- Context-aware actions.
- Cross-project organizational understanding.
- Optional MCP interoperability.

Avoid presenting the project as simply another Jira chatbot.

## Presentation

Prepare a clear demonstration showing actual end-to-end functionality.

Do not rely on fabricated results or hardcoded screenshots.

---

# 18. ACCEPTANCE CRITERIA

The MVP is considered complete only when the following conditions are satisfied.

### Core product

- [ ] Forge application is scaffolded correctly.
- [ ] Application deploys successfully.
- [ ] Application installs on a Jira Cloud test site.
- [ ] Users can access the interface.
- [ ] Current user is identified correctly.
- [ ] My Work Summary returns real Jira work items.
- [ ] Team Workload retrieves actual team information where supported.
- [ ] Issue People returns actual issue participants where supported.
- [ ] Related Work retrieves actual issue relationships.
- [ ] Rovo agent can invoke implemented actions.
- [ ] AI answers are grounded in action results.
- [ ] Errors are handled gracefully.

### Teamwork Graph

- [ ] Official Teamwork Graph request mechanism is used.
- [ ] At least one verified curated query works against live data.
- [ ] Required scopes are configured.
- [ ] Graph responses are parsed correctly.
- [ ] Permission limitations are handled.

### User experience

- [ ] UI is polished.
- [ ] Dashboard is functional.
- [ ] Loading states exist.
- [ ] Empty states exist.
- [ ] Error states exist.
- [ ] Jira links work.
- [ ] Responsive layout works.

### Quality

- [ ] Unit tests pass.
- [ ] Type checking passes.
- [ ] Linting passes.
- [ ] No critical security issues remain.
- [ ] No mandatory paid external hosting is required.
- [ ] Documentation is complete.

### Bonus features

- [ ] Rovo agent bonus eligibility verified.
- [ ] Teamwork Graph bonus eligibility verified.
- [ ] MCP bonus eligibility verified if implemented.
- [ ] Marketplace submission readiness documented if pursued.

Do not mark a criterion complete merely because code has been written. Verify its actual behavior.

---

# 19. DOCUMENTATION DELIVERABLES

Maintain these files:

## README.md

Include:
- Product introduction.
- Problem statement.
- Features.
- Architecture overview.
- Technology stack.
- Screenshots section.
- Installation.
- Development instructions.
- Deployment.
- Open-source license information.

## docs/ARCHITECTURE.md

Explain:
- Application structure.
- Frontend architecture.
- Backend architecture.
- Forge modules.
- Rovo integration.
- Teamwork Graph integration.
- Data flow.

## docs/API-INTEGRATION.md

Document:
- Jira API usage.
- Teamwork Graph queries.
- Permission scopes.
- Rovo actions.
- MCP tools, if implemented.
- Confluence integration, if implemented.

## docs/SETUP.md

Provide complete local setup instructions.

## docs/TESTING.md

Explain:
- Unit testing.
- Integration testing.
- Live testing.
- Test prerequisites.

## docs/DEPLOYMENT.md

Explain:
- Forge login.
- Development deployment.
- Production deployment.
- Installation link generation.
- Environment configuration.

Also maintain an implementation status checklist so progress can be tracked across sessions.

---

# 20. DEMO EXPERIENCE

The final product must support the following demonstration.

Scenario: A software team is developing a marketing website.

Sample Jira project: MarketingSite.

Sample issues:
- MKT-21 — Design landing page.
- MKT-22 — Implement signup form.
- MKT-23 — Write unit tests.

Use actual Jira issues created on the test site. These keys and titles are examples, not hardcoded application data.

### Demo 1 — Personal Work

Ask:

"What am I working on?"

Show actual assigned issues, statuses, priorities, and links.

### Demo 2 — Issue Ownership

Ask:

"Who is involved in MKT-21?"

Show actual assignee, reporter, and available participants.

### Demo 3 — Team Workload

Ask:

"What is my team working on?"

Show real team membership and assigned work aggregation.

### Demo 4 — Related Context

Ask:

"Are there any related issues or documents for this feature?"

Show real linked issues and available documentation.

### Demo 5 — Agent Reusability / MCP

Where implemented, demonstrate the reusable actions or MCP tools.

The demo should clearly reveal that the application is retrieving organizational context rather than generating generic AI answers.

---

# 21. HOW YOU MUST WORK WITH ME

I want you to work autonomously but transparently.

Follow these rules:

1. Start by inspecting the entire existing repository.
2. Do not ask me questions that can be answered by inspecting the repository or official documentation.
3. Make reasonable engineering decisions independently.
4. Ask me only when an essential external credential, account permission, or product decision is genuinely required.
5. Never fabricate credentials, environment variables, API responses, or deployment results.
6. Never expose secrets.
7. Do not stop after planning.
8. Implement the next logical feature after completing each phase.
9. Run tests and validation commands regularly.
10. Fix errors rather than simply reporting them.
11. Keep documentation synchronized with the implementation.
12. Preserve existing working code.
13. Keep changes focused and avoid unnecessary rewrites.
14. If a platform feature is unavailable, investigate an alternative.
15. If an implementation fails, diagnose the underlying cause before trying random fixes.

When a task requires my involvement, such as:
- Atlassian authentication.
- Creating a developer site.
- Enabling Rovo.
- Enabling Teamwork Graph preview functionality.
- Granting administrator permissions.
- Configuring an environment variable.

Stop at that specific point, explain exactly what I need to do, and continue after the required access is available.

Do not claim successful deployment without a successful deployment result.

---

# 22. INITIAL EXECUTION INSTRUCTIONS

Now begin.

Your first response should contain a concise repository assessment and an implementation checklist.

Then immediately start Phase 0 and Phase 1.

Do not spend excessive time discussing the architecture. The architecture is already described in `Project-Report.md` and this specification.

Your priority is to produce a working application.

Work incrementally:

INSPECT → PLAN → IMPLEMENT → TEST → FIX → VALIDATE → DOCUMENT.

After every meaningful phase:
- Summarize what was implemented.
- Identify files created or changed.
- Report tests and validation results.
- Identify blockers.
- Continue to the next phase whenever possible.

Maintain a project progress file named `IMPLEMENTATION-STATUS.md`.

Update it as development progresses so that work can resume reliably in future Claude Code sessions.

## FINAL OBJECTIVE

Build Teamwork Insight into a genuinely useful, polished, secure, open-source Atlassian Forge application that demonstrates the power of Rovo and Teamwork Graph.

It must solve a real organizational context problem, work with actual Atlassian data, remain inexpensive to operate, and provide a compelling end-to-end Codegeist demonstration.

**Do not build a prototype that merely looks functional. Build the actual product.**