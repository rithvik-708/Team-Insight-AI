import { route } from '@forge/api';
import { jiraGet } from './client';
import { browseUrl, isOverdue, toStatusCategory } from '../../utils/formatting';
import type {
  JiraCommentPage,
  JiraIssue,
  JiraLinkedIssue,
  JiraRemoteLink,
  JiraSearchResponse,
  JiraUser,
  JiraWatchers,
} from '../../types/jira';
import type { IssueSummary, PersonRef, WorkItem } from '../../types/domain';

export const WORK_ITEM_FIELDS = [
  'summary',
  'status',
  'priority',
  'issuetype',
  'project',
  'assignee',
  'duedate',
  'updated',
];

/** GET /rest/api/3/myself — the user the request runs as. */
export async function getCurrentUser(): Promise<PersonRef> {
  const me = await jiraGet<JiraUser>(route`/rest/api/3/myself`, 'Jira current user');
  return { accountId: me.accountId, displayName: me.displayName ?? 'You' };
}

/**
 * Enhanced JQL search (GET /rest/api/3/search/jql). The legacy /rest/api/3/search endpoint is
 * deprecated. Uses token-based pagination and stops at `maxTotal` to bound function runtime.
 */
export async function searchIssues(
  jql: string,
  fields: string[],
  maxTotal: number,
): Promise<{ issues: JiraIssue[]; truncated: boolean }> {
  const issues: JiraIssue[] = [];
  const fieldList = fields.join(',');
  let token: string | undefined;
  for (let page = 0; page < 10; page++) {
    const pageSize = Math.min(100, maxTotal - issues.length);
    const path = token
      ? route`/rest/api/3/search/jql?jql=${jql}&fields=${fieldList}&maxResults=${pageSize}&nextPageToken=${token}`
      : route`/rest/api/3/search/jql?jql=${jql}&fields=${fieldList}&maxResults=${pageSize}`;
    const res = await jiraGet<JiraSearchResponse>(path, 'Jira issue search');
    issues.push(...(res.issues ?? []));
    token = res.nextPageToken;
    const exhausted = res.isLast === true || !token;
    if (exhausted) return { issues, truncated: false };
    if (issues.length >= maxTotal) return { issues, truncated: true };
  }
  return { issues, truncated: true };
}

export function getIssue(issueKey: string, fields: string[]): Promise<JiraIssue> {
  return jiraGet<JiraIssue>(
    route`/rest/api/3/issue/${issueKey}?fields=${fields.join(',')}`,
    'Jira issue',
  );
}

export function getIssueComments(issueKey: string): Promise<JiraCommentPage> {
  return jiraGet<JiraCommentPage>(
    route`/rest/api/3/issue/${issueKey}/comment?orderBy=-created&maxResults=100`,
    'Jira issue comments',
  );
}

export function getIssueWatchers(issueKey: string): Promise<JiraWatchers> {
  return jiraGet<JiraWatchers>(
    route`/rest/api/3/issue/${issueKey}/watchers`,
    'Jira issue watchers',
  );
}

export async function getIssueRemoteLinks(issueKey: string): Promise<JiraRemoteLink[]> {
  const links = await jiraGet<JiraRemoteLink[]>(
    route`/rest/api/3/issue/${issueKey}/remotelink`,
    'Jira remote links',
  );
  return Array.isArray(links) ? links : [];
}

export function toPerson(user: JiraUser | null | undefined): PersonRef | undefined {
  if (!user || (!user.accountId && !user.displayName)) return undefined;
  return { accountId: user.accountId, displayName: user.displayName ?? 'Unknown user' };
}

/** Converts a full Jira issue into the normalised WorkItem shape. Returns undefined if the key is missing. */
export function toWorkItem(issue: JiraIssue, siteUrl: string | undefined): WorkItem | undefined {
  if (!issue.key) return undefined;
  const f = issue.fields ?? {};
  const statusCategory = toStatusCategory(f.status?.statusCategory?.key);
  const dueDate = f.duedate ?? undefined;
  return {
    key: issue.key,
    summary: f.summary ?? '(no summary)',
    url: browseUrl(siteUrl, issue.key),
    status: f.status?.name ?? 'Unknown',
    statusCategory,
    priority: f.priority?.name ?? undefined,
    issueType: f.issuetype?.name,
    project: f.project?.key
      ? { key: f.project.key, name: f.project.name, id: f.project.id }
      : undefined,
    assignee: toPerson(f.assignee),
    dueDate,
    updated: f.updated,
    isOverdue: isOverdue(dueDate, statusCategory),
    source: 'jira',
  };
}

export function toIssueSummary(issue: JiraIssue, siteUrl: string | undefined): IssueSummary {
  const f = issue.fields ?? {};
  const key = issue.key ?? 'UNKNOWN';
  return {
    key,
    summary: f.summary ?? '(no summary)',
    url: browseUrl(siteUrl, key),
    status: f.status?.name ?? 'Unknown',
    statusCategory: toStatusCategory(f.status?.statusCategory?.key),
    priority: f.priority?.name ?? undefined,
    issueType: f.issuetype?.name,
    project: f.project?.key
      ? { key: f.project.key, name: f.project.name, id: f.project.id }
      : undefined,
  };
}

/** Linked issues embedded in issuelinks / parent / subtasks carry only a partial field set. */
export function linkedToSummary(
  linked: JiraLinkedIssue,
  siteUrl: string | undefined,
): IssueSummary | undefined {
  if (!linked.key) return undefined;
  const f = linked.fields ?? {};
  return {
    key: linked.key,
    summary: f.summary ?? '(no summary)',
    url: browseUrl(siteUrl, linked.key),
    status: f.status?.name ?? 'Unknown',
    statusCategory: toStatusCategory(f.status?.statusCategory?.key),
    priority: f.priority?.name,
    issueType: f.issuetype?.name,
  };
}
