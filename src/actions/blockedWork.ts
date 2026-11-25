import { getSiteUrl } from '../services/jira/client';
import { WORK_ITEM_FIELDS, searchIssues, toWorkItem } from '../services/jira/issues';
import { sortWorkItems } from '../utils/formatting';
import { quoteQueryString } from '../utils/validation';
import { isBlockedByRelation, relatedLinks } from './shared';
import type { BlockedItem, BlockedWorkResult } from '../types/domain';

const SCAN_CAP = 200;

/**
 * "Which issues are blocked?" Scans open issues (yours, or a project's) and keeps those with an
 * inward "is blocked by" link. Filtering happens locally rather than with JQL `issueLinkType`
 * because link type names are site-configurable and an unknown name makes the JQL fail.
 */
export async function blockedWork(projectKey?: string): Promise<BlockedWorkResult> {
  const scopeJql = projectKey
    ? `project = ${quoteQueryString(projectKey)}`
    : 'assignee = currentUser()';
  const jql = `${scopeJql} AND statusCategory != Done ORDER BY priority DESC, updated DESC`;
  const [res, siteUrl] = await Promise.all([
    searchIssues(jql, [...WORK_ITEM_FIELDS, 'issuelinks'], SCAN_CAP),
    getSiteUrl(),
  ]);

  const items: BlockedItem[] = [];
  for (const issue of res.issues) {
    const blockers = relatedLinks(issue, siteUrl).filter(isBlockedByRelation);
    if (blockers.length === 0) continue;
    const base = toWorkItem(issue, siteUrl);
    if (!base) continue;
    items.push({
      ...base,
      blockers,
      allBlockersResolved: blockers.every((b) => b.statusCategory === 'done'),
    });
  }

  const sorted = sortWorkItems(items) as BlockedItem[];
  // Actively blocked first; items whose blockers are all done (stale links) last.
  sorted.sort((a, b) => Number(a.allBlockersResolved) - Number(b.allBlockersResolved));

  const notes: string[] = [];
  if (res.truncated) notes.push(`Only the ${SCAN_CAP} highest-priority open issues were scanned.`);
  if (sorted.some((i) => i.allBlockersResolved)) {
    notes.push(
      'Some issues are linked as blocked, but every blocker is already done. Those links may be outdated.',
    );
  }

  return {
    scope: projectKey ? { kind: 'project', projectKey } : { kind: 'mine' },
    items: sorted,
    truncated: res.truncated,
    sources: [
      {
        source: 'jira',
        purpose: 'open issues with "is blocked by" links (JQL search)',
        status: sorted.length > 0 ? 'ok' : 'empty',
      },
    ],
    notes,
  };
}
