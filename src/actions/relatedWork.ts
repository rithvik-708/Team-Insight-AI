import { getSiteUrl } from '../services/jira/client';
import {
  WORK_ITEM_FIELDS,
  getIssueRemoteLinks,
  linkedToSummary,
  searchIssues,
  toIssueSummary,
  toPerson,
  toWorkItem,
} from '../services/jira/issues';
import { describeFailure } from '../utils/errors';
import { quoteQueryString } from '../utils/validation';
import { isBlockedByRelation, isBlocksRelation, loadIssueDetail, relatedLinks } from './shared';
import type { RelatedIssue, RelatedWorkResult, SourceReport } from '../types/domain';

/**
 * Related work for one issue: parent, children, issue links (with blocker detection) and remote
 * links. Jira REST is used here because issue-to-issue links, parent/child hierarchy and remote
 * links are not exposed by any curated Teamwork Graph query (verified against the catalog).
 */
export async function relatedWork(issueKey: string): Promise<RelatedWorkResult> {
  const [issue, siteUrl] = await Promise.all([loadIssueDetail(issueKey), getSiteUrl()]);
  const f = issue.fields ?? {};
  const sources: SourceReport[] = [
    { source: 'jira', purpose: 'issue links, parent and sub-tasks', status: 'ok' },
  ];
  const notes: string[] = [];

  const links = relatedLinks(issue, siteUrl);

  let parent: RelatedIssue | undefined;
  if (f.parent) {
    const p = linkedToSummary(f.parent, siteUrl);
    if (p) parent = { ...p, relationship: 'parent', source: 'jira' };
  }

  const children = new Map<string, RelatedIssue>();
  for (const sub of f.subtasks ?? []) {
    const s = linkedToSummary(sub, siteUrl);
    if (s) children.set(s.key, { ...s, relationship: 'sub-task', source: 'jira' });
  }

  const [childSearch, remote] = await Promise.all([
    searchIssues(
      `parent = ${quoteQueryString(issueKey)} ORDER BY rank ASC`,
      WORK_ITEM_FIELDS,
      50,
    ).then(
      (r) => ({ ok: true as const, ...r }),
      (err: unknown) => ({ ok: false as const, err }),
    ),
    getIssueRemoteLinks(issueKey).then(
      (value) => ({ ok: true as const, value }),
      (err: unknown) => ({ ok: false as const, err }),
    ),
  ]);

  if (childSearch.ok) {
    for (const raw of childSearch.issues) {
      const item = toWorkItem(raw, siteUrl);
      if (!item || children.has(item.key)) continue;
      children.set(item.key, {
        key: item.key,
        summary: item.summary,
        url: item.url,
        status: item.status,
        statusCategory: item.statusCategory,
        priority: item.priority,
        issueType: item.issueType,
        project: item.project,
        assignee: toPerson(raw.fields?.assignee),
        relationship: 'child',
        source: 'jira',
      });
    }
    if (childSearch.truncated) notes.push('Only the first 50 child issues are shown.');
  } else {
    sources.push({
      source: 'jira',
      purpose: 'child issues',
      status: 'error',
      detail: describeFailure(childSearch.err),
    });
  }

  const remoteLinks = remote.ok
    ? remote.value
        .filter((r) => r.object?.url && /^https?:\/\//i.test(r.object.url))
        .map((r) => ({
          title: r.object?.title ?? r.object!.url!,
          url: r.object!.url!,
          application: r.application?.name ?? r.application?.type,
        }))
    : [];
  if (!remote.ok) {
    sources.push({
      source: 'jira',
      purpose: 'remote links',
      status: 'error',
      detail: describeFailure(remote.err),
    });
  }

  const blockedBy = links.filter(isBlockedByRelation);
  const blocks = links.filter(isBlocksRelation);

  return {
    issue: toIssueSummary(issue, siteUrl),
    parent,
    children: [...children.values()],
    links,
    blockedBy,
    blocks,
    isBlocked: blockedBy.some((b) => b.statusCategory !== 'done'),
    remoteLinks,
    sources,
    notes,
  };
}
