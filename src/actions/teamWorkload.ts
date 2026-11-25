import { getSiteUrl } from '../services/jira/client';
import { WORK_ITEM_FIELDS, searchIssues, toWorkItem } from '../services/jira/issues';
import { getTeamMembers, getUserTeams, type TeamMember } from '../services/teamworkGraph/teams';
import { AppError, describeFailure } from '../utils/errors';
import { chunk, isHighPriority, sortWorkItems } from '../utils/formatting';
import { quoteQueryString } from '../utils/validation';
import type { RequestContext } from '../types/actions';
import type {
  MemberWorkload,
  ProjectRef,
  SourceReport,
  TeamRef,
  TeamWorkloadResult,
  WorkItem,
} from '../types/domain';

export interface TeamWorkloadInput {
  teamId?: string;
  teamName?: string;
  projectKey?: string;
}

const ISSUE_CAP = 300;
const MEMBERS_PER_QUERY = 50;

export const WORKLOAD_DISCLAIMER =
  'Open issue counts show assigned work only. They are not a measure of effort, capacity or performance.';

/**
 * "What is my team working on?"
 * Team discovery and membership come from Teamwork Graph (`atlassianUserInTeams`,
 * `atlassianTeamMembers`). Open work per member is aggregated from one batched Jira JQL search,
 * which filters by status category server-side and returns priority (unavailable on the Graph type).
 */
export async function teamWorkload(
  ctx: RequestContext,
  input: TeamWorkloadInput = {},
): Promise<TeamWorkloadResult> {
  const explicitTeam = input.teamId || input.teamName;
  if (input.projectKey && !explicitTeam) {
    return projectWorkload(input.projectKey);
  }

  const sources: SourceReport[] = [];
  let teams: TeamRef[] = [];
  try {
    const result = await getUserTeams(ctx.accountId);
    teams = result.teams;
    sources.push({
      source: 'teamworkGraph',
      purpose: 'your teams (atlassianUserInTeams)',
      status: teams.length > 0 ? 'ok' : 'empty',
    });
  } catch (err) {
    sources.push({
      source: 'teamworkGraph',
      purpose: 'your teams (atlassianUserInTeams)',
      status: 'error',
      detail: describeFailure(err),
    });
    if (!input.teamId) {
      return {
        status: 'no_team',
        teams: [],
        message: `Your teams could not be loaded from Teamwork Graph: ${describeFailure(err)} You can ask for a project's workload instead (for example "workload for project MKT").`,
        sources,
      };
    }
  }

  const selected = selectTeam(teams, input);
  if (selected.kind === 'none') {
    return {
      status: 'no_team',
      teams,
      message: input.teamName
        ? `You are not a member of a team named "${input.teamName}". ${teams.length > 0 ? 'Choose one of your teams listed here.' : ''}`.trim()
        : 'You do not belong to any Atlassian team that is visible to you. Create or join a team in Atlassian Home, or ask for a project\'s workload instead (for example "workload for project MKT").',
      sources,
    };
  }
  if (selected.kind === 'ambiguous') {
    return {
      status: 'needs_team_selection',
      teams: selected.candidates,
      message: 'You belong to more than one team. Which team do you mean?',
      sources,
    };
  }

  const team = selected.team;
  const { members, hasMore } = await getTeamMembers(team.id);
  sources.push({
    source: 'teamworkGraph',
    purpose: 'team members (atlassianTeamMembers)',
    status: members.length > 0 ? 'ok' : 'empty',
  });
  const notes: string[] = [];
  if (hasMore) notes.push('Only the first 100 team members were included.');
  if (members.length === 0) {
    notes.push('No team members are visible to you for this team.');
  }

  const siteUrl = await getSiteUrl();
  let items: WorkItem[] = [];
  let truncated = false;
  if (members.length > 0) {
    const fetched = await fetchOpenWorkForMembers(members, siteUrl);
    items = fetched.items;
    truncated = fetched.truncated;
    sources.push({
      source: 'jira',
      purpose: 'open issues assigned to team members (JQL search)',
      status: items.length > 0 ? 'ok' : 'empty',
    });
  }
  if (truncated) notes.push(`Only the first ${ISSUE_CAP} open issues were counted.`);

  return {
    status: 'ok',
    scope: { kind: 'team', team },
    ...aggregateWorkload(members, items),
    truncated,
    disclaimer: WORKLOAD_DISCLAIMER,
    sources,
    notes,
  };
}

type TeamSelection =
  | { kind: 'selected'; team: TeamRef }
  | { kind: 'ambiguous'; candidates: TeamRef[] }
  | { kind: 'none' };

/**
 * Picks the team to report on. Never silently defaults to the first of several teams.
 * An explicit teamId the user is not a member of is still allowed: Teamwork Graph permission-filters
 * the membership query, so the user only sees what they could already see.
 */
export function selectTeam(teams: TeamRef[], input: TeamWorkloadInput): TeamSelection {
  if (input.teamId) {
    const match = teams.find((t) => t.id === input.teamId);
    return { kind: 'selected', team: match ?? { id: input.teamId, name: 'Selected team' } };
  }
  if (input.teamName) {
    const wanted = input.teamName.trim().toLowerCase();
    const exact = teams.filter((t) => t.name.toLowerCase() === wanted);
    if (exact.length === 1) return { kind: 'selected', team: exact[0] };
    const partial = teams.filter((t) => t.name.toLowerCase().includes(wanted));
    if (partial.length === 1) return { kind: 'selected', team: partial[0] };
    if (partial.length > 1) return { kind: 'ambiguous', candidates: partial };
    return { kind: 'none' };
  }
  if (teams.length === 1) return { kind: 'selected', team: teams[0] };
  if (teams.length > 1) return { kind: 'ambiguous', candidates: teams };
  return { kind: 'none' };
}

async function fetchOpenWorkForMembers(
  members: TeamMember[],
  siteUrl: string | undefined,
): Promise<{ items: WorkItem[]; truncated: boolean }> {
  const items: WorkItem[] = [];
  let truncated = false;
  for (const group of chunk(members, MEMBERS_PER_QUERY)) {
    const remaining = ISSUE_CAP - items.length;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const ids = group.map((m) => quoteQueryString(m.accountId)).join(', ');
    const jql = `assignee in (${ids}) AND statusCategory != Done ORDER BY priority DESC, updated DESC`;
    const res = await searchIssues(jql, WORK_ITEM_FIELDS, remaining);
    truncated = truncated || res.truncated;
    for (const issue of res.issues) {
      const item = toWorkItem(issue, siteUrl);
      if (item) items.push(item);
    }
  }
  return { items, truncated };
}

/** Project-scoped fallback when the user has no team or asks about a project explicitly. */
async function projectWorkload(projectKey: string): Promise<TeamWorkloadResult> {
  const siteUrl = await getSiteUrl();
  const jql = `project = ${quoteQueryString(projectKey)} AND statusCategory != Done ORDER BY priority DESC, updated DESC`;
  const res = await searchIssues(jql, WORK_ITEM_FIELDS, ISSUE_CAP);
  const items = res.issues.map((i) => toWorkItem(i, siteUrl)).filter((i): i is WorkItem => !!i);
  if (items.length === 0 && res.issues.length === 0) {
    // Either an empty project or one the user cannot browse; JQL doesn't distinguish the two.
    throw new AppError(
      'NOT_FOUND',
      `No open issues were found in project ${projectKey}, or the project does not exist or is not visible to you.`,
    );
  }
  const assignees = new Map<string, TeamMember>();
  for (const item of items) {
    if (item.assignee?.accountId) {
      assignees.set(item.assignee.accountId, {
        accountId: item.assignee.accountId,
        displayName: item.assignee.displayName,
      });
    }
  }
  const project: ProjectRef = items[0]?.project ?? { key: projectKey };
  const unassignedOpen = items.filter((i) => !i.assignee?.accountId).length;
  const aggregate = aggregateWorkload([...assignees.values()], items);
  return {
    status: 'ok',
    scope: { kind: 'project', project },
    ...aggregate,
    totals: { ...aggregate.totals, unassignedOpen },
    truncated: res.truncated,
    disclaimer: WORKLOAD_DISCLAIMER,
    sources: [
      {
        source: 'jira',
        purpose: `open issues in project ${projectKey} (JQL search)`,
        status: 'ok',
      },
    ],
    notes: [
      'This is a project view: "members" are people with open issues assigned in this project, not an Atlassian team.',
      ...(res.truncated ? [`Only the first ${ISSUE_CAP} open issues were counted.`] : []),
    ],
  };
}

/**
 * Pure aggregation: per-member counts, status distribution, load flags and top priorities.
 * "High" load = at least 5 open issues and at least 1.5x the team average (needs 2+ members).
 */
export function aggregateWorkload(members: TeamMember[], items: WorkItem[]) {
  const byMember = new Map<string, WorkItem[]>();
  for (const m of members) byMember.set(m.accountId, []);
  for (const item of items) {
    const id = item.assignee?.accountId;
    if (id && byMember.has(id)) byMember.get(id)!.push(item);
  }

  const counted = [...byMember.values()].flat();
  const average = members.length > 0 ? counted.length / members.length : 0;

  const statusDistribution: Record<string, number> = {};
  for (const item of counted) {
    statusDistribution[item.status] = (statusDistribution[item.status] ?? 0) + 1;
  }

  const memberRows: MemberWorkload[] = members.map((m) => {
    const work = sortWorkItems(byMember.get(m.accountId) ?? []);
    const openCount = work.length;
    let loadFlag: MemberWorkload['loadFlag'] = 'normal';
    if (openCount === 0) loadFlag = 'none';
    else if (members.length >= 2 && openCount >= 5 && openCount >= average * 1.5) loadFlag = 'high';
    return {
      accountId: m.accountId,
      displayName: m.displayName,
      openCount,
      inProgressCount: work.filter((w) => w.statusCategory === 'in_progress').length,
      todoCount: work.filter((w) => w.statusCategory === 'todo').length,
      highPriorityCount: work.filter((w) => isHighPriority(w.priority)).length,
      overdueCount: work.filter((w) => w.isOverdue).length,
      topItems: work.slice(0, 3),
      loadFlag,
    };
  });
  memberRows.sort(
    (a, b) => b.openCount - a.openCount || a.displayName.localeCompare(b.displayName),
  );

  return {
    members: memberRows,
    totals: {
      open: counted.length,
      members: members.length,
      averagePerMember: Math.round(average * 10) / 10,
      statusDistribution,
    },
    highLoadMembers: memberRows.filter((m) => m.loadFlag === 'high').map((m) => m.displayName),
    membersWithoutWork: memberRows.filter((m) => m.loadFlag === 'none').map((m) => m.displayName),
    topPriorityItems: sortWorkItems(
      counted.filter((i) => isHighPriority(i.priority) || i.isOverdue),
    ).slice(0, 5),
  };
}
