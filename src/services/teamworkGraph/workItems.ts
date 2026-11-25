import { graphQuery, paginateConnection } from './client';
import { ASSIGNED_WORK_ITEMS_QUERY, ECHO_QUERY, WORK_ITEM_COMMENTS_QUERY } from './queries';
import { jiraIssueAri, userAri } from './aris';
import { isOverdue, toStatusCategory } from '../../utils/formatting';
import type {
  Connection,
  GraphJiraWorkItem,
  GraphWorkItemComment,
} from '../../types/teamworkGraph';
import type { WorkItem } from '../../types/domain';

export function graphNodeToWorkItem(node: GraphJiraWorkItem): WorkItem | undefined {
  if (node.__typename && node.__typename !== 'JiraWorkItem') return undefined;
  if (!node.key) return undefined;
  const statusCategory = toStatusCategory(node.status?.statusCategory?.key);
  const dueDate = node.dueAt ?? undefined;
  return {
    key: node.key,
    summary: node.summary ?? '(no summary)',
    url: node.webUrl ?? undefined,
    status: node.status?.name ?? 'Unknown',
    statusCategory,
    issueType: node.issueType?.name ?? undefined,
    dueDate,
    isOverdue: isOverdue(dueDate, statusCategory),
    source: 'teamworkGraph',
  };
}

/**
 * Jira work items assigned to a user (curated query `atlassianUserAssignedJiraWorkItems`).
 * The connection includes completed items, so callers filter by status category.
 */
export async function getAssignedWorkItems(
  accountId: string,
  maxPages = 4,
): Promise<{ items: WorkItem[]; hasMore: boolean }> {
  const { nodes, hasMore } = await paginateConnection<GraphJiraWorkItem>(
    'teamworkInsight_assignedWorkItems',
    ASSIGNED_WORK_ITEMS_QUERY,
    { userId: userAri(accountId) },
    (data) => data.atlassianUserAssignedJiraWorkItems as Connection<GraphJiraWorkItem>,
    maxPages,
  );
  const items: WorkItem[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    const item = graphNodeToWorkItem(node);
    if (item && !seen.has(item.key)) {
      seen.add(item.key);
      items.push(item);
    }
  }
  return { items, hasMore };
}

export interface GraphCommentAuthor {
  displayName: string;
  commentCount: number;
  lastCommentAt?: string;
}

/** Comment authors on an issue within a window (curated query `jiraWorkItemComments`). */
export async function getWorkItemCommentAuthors(
  cloudId: string,
  issueId: string,
  since = 'P90D',
): Promise<GraphCommentAuthor[]> {
  const { nodes } = await paginateConnection<GraphWorkItemComment>(
    'teamworkInsight_workItemComments',
    WORK_ITEM_COMMENTS_QUERY,
    { id: jiraIssueAri(cloudId, issueId), since },
    (data) => data.jiraWorkItemComments as Connection<GraphWorkItemComment>,
    2,
  );
  const byName = new Map<string, GraphCommentAuthor>();
  for (const node of nodes) {
    if (node.deleted) continue;
    const name = node.author?.name?.trim();
    if (!name) continue;
    const existing = byName.get(name) ?? { displayName: name, commentCount: 0 };
    existing.commentCount += 1;
    if (node.createdAt && (!existing.lastCommentAt || node.createdAt > existing.lastCommentAt)) {
      existing.lastCommentAt = node.createdAt;
    }
    byName.set(name, existing);
  }
  return [...byName.values()];
}

/** Documented connectivity probe (`echo`). Used by the dashboard's integration status indicator. */
export async function pingGraph(): Promise<boolean> {
  const data = await graphQuery<{ echo?: string }>('teamworkInsight_echo', ECHO_QUERY, {
    value: 'teamwork-insight',
  });
  return data.echo === 'teamwork-insight';
}
