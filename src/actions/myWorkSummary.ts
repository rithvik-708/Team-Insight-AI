import { getSiteUrl } from '../services/jira/client';
import {
  WORK_ITEM_FIELDS,
  getCurrentUser,
  searchIssues,
  toWorkItem,
} from '../services/jira/issues';
import { getAssignedWorkItems } from '../services/teamworkGraph/workItems';
import { describeFailure } from '../utils/errors';
import { isHighPriority, sortWorkItems, priorityRank } from '../utils/formatting';
import { quoteQueryString } from '../utils/validation';
import type { RequestContext } from '../types/actions';
import type { FocusSuggestion, MyWorkResult, SourceReport, WorkItem } from '../types/domain';

export interface MyWorkInput {
  includeDone?: boolean;
  limit?: number;
  projectKey?: string;
}

const JIRA_OPEN_ASSIGNED_CAP = 100;

/**
 * "What am I working on?" — assigned work for the invoking user.
 *
 * Teamwork Graph (`atlassianUserAssignedJiraWorkItems`) is the primary source. Jira search runs in
 * parallel for two documented reasons: the Graph JiraWorkItem type has no priority/project fields
 * (we enrich by key), and it keeps the answer complete if the Graph is unavailable or truncated.
 * Every item records which source returned it.
 */
export async function myWorkSummary(
  ctx: RequestContext,
  input: MyWorkInput = {},
): Promise<MyWorkResult> {
  const includeDone = input.includeDone ?? false;
  const limit = input.limit ?? 10;
  const sources: SourceReport[] = [];
  const notes: string[] = [];

  const jql = [
    'assignee = currentUser()',
    includeDone ? undefined : 'statusCategory != Done',
    input.projectKey ? `project = ${quoteQueryString(input.projectKey)}` : undefined,
  ]
    .filter(Boolean)
    .join(' AND ')
    .concat(' ORDER BY updated DESC');

  const [graphResult, jiraResult, me, siteUrl] = await Promise.all([
    getAssignedWorkItems(ctx.accountId).then(
      (r) => ({ ok: true as const, ...r }),
      (err: unknown) => ({ ok: false as const, err }),
    ),
    searchIssues(jql, WORK_ITEM_FIELDS, JIRA_OPEN_ASSIGNED_CAP).then(
      (r) => ({ ok: true as const, ...r }),
      (err: unknown) => ({ ok: false as const, err }),
    ),
    getCurrentUser().catch(() => ({ accountId: ctx.accountId, displayName: 'You' })),
    getSiteUrl(),
  ]);

  // If both sources failed there is nothing truthful to return.
  if (!graphResult.ok && !jiraResult.ok) throw jiraResult.err;

  const jiraByKey = new Map<string, WorkItem>();
  if (jiraResult.ok) {
    for (const issue of jiraResult.issues) {
      const item = toWorkItem(issue, siteUrl);
      if (item) jiraByKey.set(item.key, item);
    }
    sources.push({
      source: 'jira',
      purpose: 'priority, project and completeness check (JQL search)',
      status: jiraByKey.size > 0 ? 'ok' : 'empty',
    });
    if (jiraResult.truncated) {
      notes.push(`Jira search was capped at ${JIRA_OPEN_ASSIGNED_CAP} issues.`);
    }
  } else {
    sources.push({
      source: 'jira',
      purpose: 'priority and project details',
      status: 'error',
      detail: describeFailure(jiraResult.err),
    });
    notes.push('Priority and project details are missing because the Jira search failed.');
  }

  // When the Jira search succeeded completely, it is the live authority on "assigned to me and
  // open". A Graph item absent from it was closed or reassigned after the graph indexed it.
  const jiraIsAuthoritative = jiraResult.ok && !jiraResult.truncated;
  const merged = new Map<string, WorkItem>();
  if (graphResult.ok) {
    let graphCount = 0;
    let stale = 0;
    for (const graphItem of graphResult.items) {
      if (input.projectKey && !graphItem.key.startsWith(`${input.projectKey}-`)) continue;
      const jiraItem = jiraByKey.get(graphItem.key);
      if (!jiraItem && jiraIsAuthoritative && graphItem.statusCategory !== 'done' && !includeDone) {
        stale++;
        continue;
      }
      // Graph identifies the item; live Jira fields (status, priority, project) win when present.
      merged.set(graphItem.key, {
        ...graphItem,
        status: jiraItem?.status ?? graphItem.status,
        statusCategory: jiraItem?.statusCategory ?? graphItem.statusCategory,
        isOverdue: jiraItem?.isOverdue ?? graphItem.isOverdue,
        dueDate: jiraItem?.dueDate ?? graphItem.dueDate,
        priority: jiraItem?.priority,
        project: jiraItem?.project,
        updated: jiraItem?.updated,
        url: graphItem.url ?? jiraItem?.url,
      });
      graphCount++;
    }
    if (stale > 0) {
      notes.push(
        `${stale} graph item(s) were skipped because Jira shows them as closed or reassigned.`,
      );
    }
    sources.push({
      source: 'teamworkGraph',
      purpose: 'assigned work items (atlassianUserAssignedJiraWorkItems)',
      status: graphCount > 0 ? 'ok' : 'empty',
      detail: graphResult.hasMore
        ? 'More than 100 assigned items; older ones not scanned.'
        : undefined,
    });
  } else {
    sources.push({
      source: 'teamworkGraph',
      purpose: 'assigned work items (atlassianUserAssignedJiraWorkItems)',
      status: 'error',
      detail: describeFailure(graphResult.err),
    });
    notes.push('Teamwork Graph was unavailable, so results come from Jira search only.');
  }

  let jiraOnly = 0;
  for (const [key, jiraItem] of jiraByKey) {
    if (!merged.has(key)) {
      merged.set(key, jiraItem);
      jiraOnly++;
    }
  }
  if (graphResult.ok && jiraOnly > 0) {
    notes.push(
      `${jiraOnly} item(s) were found only by Jira search (the graph may still be indexing them).`,
    );
  }

  const all = [...merged.values()].filter((i) => includeDone || i.statusCategory !== 'done');
  const sorted = sortWorkItems(all);
  const open = all.filter((i) => i.statusCategory !== 'done');

  return {
    user: { accountId: me.accountId ?? ctx.accountId, displayName: me.displayName },
    totals: {
      open: open.length,
      highPriority: open.filter((i) => isHighPriority(i.priority)).length,
      overdue: open.filter((i) => i.isOverdue).length,
      inProgress: open.filter((i) => i.statusCategory === 'in_progress').length,
    },
    items: sorted.slice(0, limit),
    suggestedFocus: suggestFocus(open),
    truncated: sorted.length > limit,
    sources,
    notes,
  };
}

/**
 * Deterministic "what should I focus on next" heuristic. Labelled as a suggestion everywhere it is
 * shown; the reasons list states exactly which facts drove the ranking.
 */
export function suggestFocus(openItems: WorkItem[], count = 3): FocusSuggestion[] {
  const scored = openItems.map((item) => {
    const reasons: string[] = [];
    let score = 0;
    if (item.isOverdue) {
      score += 50;
      reasons.push(`overdue (due ${item.dueDate?.slice(0, 10)})`);
    }
    const rank = priorityRank(item.priority);
    score += Math.max(0, 6 - rank) * 6;
    if (isHighPriority(item.priority)) reasons.push(`${item.priority} priority`);
    if (item.statusCategory === 'in_progress') {
      score += 12;
      reasons.push('already in progress');
    }
    if (!item.isOverdue && item.dueDate) {
      const days = (Date.parse(item.dueDate.slice(0, 10)) - Date.now()) / 86_400_000;
      if (days >= 0 && days <= 7) {
        score += 20;
        reasons.push(`due soon (${item.dueDate.slice(0, 10)})`);
      }
    }
    if (reasons.length === 0) reasons.push('next in priority order');
    return { item, score, reasons };
  });
  scored.sort((a, b) => b.score - a.score || a.item.key.localeCompare(b.item.key));
  return scored.slice(0, count).map(({ item, reasons }) => ({
    key: item.key,
    summary: item.summary,
    url: item.url,
    reasons,
  }));
}
