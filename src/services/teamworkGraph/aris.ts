/**
 * ARI builders. Formats from developer.atlassian.com/platform/teamwork-graph/understanding-aris:
 *   user:          ari:cloud:identity::user/{accountId}
 *   team:          ari:cloud:identity::team/{teamId}
 *   Jira issue:    ari:cloud:jira:{cloudId}:issue/{issueId}
 *   Jira project:  ari:cloud:jira:{cloudId}:project/{projectId}
 */
export function userAri(accountId: string): string {
  return `ari:cloud:identity::user/${accountId}`;
}

export function jiraIssueAri(cloudId: string, issueId: string): string {
  return `ari:cloud:jira:${cloudId}:issue/${issueId}`;
}

export function jiraProjectAri(cloudId: string, projectId: string): string {
  return `ari:cloud:jira:${cloudId}:project/${projectId}`;
}
