import { paginateConnection } from './client';
import { TEAMS_BY_SPACE_QUERY, TEAM_MEMBERS_QUERY, USER_TEAMS_QUERY } from './queries';
import { jiraProjectAri, userAri } from './aris';
import type { Connection, GraphAtlassianTeam, GraphAtlassianUser } from '../../types/teamworkGraph';
import type { PersonRef, TeamRef } from '../../types/domain';

export function toTeamRef(node: GraphAtlassianTeam): TeamRef | undefined {
  if (node.__typename && node.__typename !== 'AtlassianTeam') return undefined;
  if (!node.id) return undefined;
  return {
    id: node.id,
    name: node.displayName?.trim() || 'Unnamed team',
    description: node.description ?? undefined,
    url: node.profileUrl ?? undefined,
  };
}

function compactTeams(nodes: GraphAtlassianTeam[]): TeamRef[] {
  const seen = new Set<string>();
  const teams: TeamRef[] = [];
  for (const node of nodes) {
    const team = toTeamRef(node);
    if (team && !seen.has(team.id)) {
      seen.add(team.id);
      teams.push(team);
    }
  }
  return teams;
}

/** Teams the user belongs to (curated query `atlassianUserInTeams`), most recently updated first. */
export async function getUserTeams(
  accountId: string,
): Promise<{ teams: TeamRef[]; hasMore: boolean }> {
  const { nodes, hasMore } = await paginateConnection<GraphAtlassianTeam>(
    'teamworkInsight_userTeams',
    USER_TEAMS_QUERY,
    { userId: userAri(accountId) },
    (data) => data.atlassianUserInTeams as Connection<GraphAtlassianTeam>,
    2,
  );
  return { teams: compactTeams(nodes), hasMore };
}

export interface TeamMember extends PersonRef {
  accountId: string;
}

/** Members of a team (curated query `atlassianTeamMembers`). Capped at 100 members. */
export async function getTeamMembers(
  teamAri: string,
): Promise<{ members: TeamMember[]; hasMore: boolean }> {
  const { nodes, hasMore } = await paginateConnection<GraphAtlassianUser>(
    'teamworkInsight_teamMembers',
    TEAM_MEMBERS_QUERY,
    { teamAri },
    (data) => data.atlassianTeamMembers as Connection<GraphAtlassianUser>,
    4,
  );
  const seen = new Set<string>();
  const members: TeamMember[] = [];
  for (const node of nodes) {
    if (node.__typename && node.__typename !== 'AtlassianUser') continue;
    const accountId = node.accountId ?? undefined;
    if (!accountId || seen.has(accountId)) continue;
    seen.add(accountId);
    members.push({ accountId, displayName: node.name?.trim() || 'Unknown user' });
  }
  return { members, hasMore };
}

/** Teams linked to a Jira space/project (curated query `atlassianTeamsBySpace`). */
export async function getTeamsForProject(cloudId: string, projectId: string): Promise<TeamRef[]> {
  const { nodes } = await paginateConnection<GraphAtlassianTeam>(
    'teamworkInsight_teamsBySpace',
    TEAMS_BY_SPACE_QUERY,
    { spaceAri: jiraProjectAri(cloudId, projectId) },
    (data) => data.atlassianTeamsBySpace as Connection<GraphAtlassianTeam>,
    1,
  );
  return compactTeams(nodes);
}
