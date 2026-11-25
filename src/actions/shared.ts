import { getIssue, linkedToSummary, toPerson } from '../services/jira/issues';
import type { JiraIssue, JiraIssueLink } from '../types/jira';
import type { RelatedIssue } from '../types/domain';

export const ISSUE_DETAIL_FIELDS = [
  'summary',
  'status',
  'priority',
  'issuetype',
  'project',
  'assignee',
  'reporter',
  'creator',
  'issuelinks',
  'parent',
  'subtasks',
  'duedate',
  'updated',
];

export function loadIssueDetail(issueKey: string): Promise<JiraIssue> {
  return getIssue(issueKey, ISSUE_DETAIL_FIELDS);
}

/**
 * Converts a Jira issue link into a RelatedIssue from the perspective of the issue that owns it.
 * Jira semantics: when `inwardIssue` is present, the *other* issue is on the inward side, so the
 * relationship read from our issue is `type.inward` (e.g. "is blocked by").
 */
export function linkToRelated(
  link: JiraIssueLink,
  siteUrl: string | undefined,
): RelatedIssue | undefined {
  const other = link.inwardIssue ?? link.outwardIssue;
  if (!other) return undefined;
  const summary = linkedToSummary(other, siteUrl);
  if (!summary) return undefined;
  const direction = link.inwardIssue ? 'inward' : 'outward';
  const relationship =
    (direction === 'inward' ? link.type?.inward : link.type?.outward) ??
    link.type?.name ??
    'relates to';
  return { ...summary, relationship, direction, source: 'jira' };
}

export function isBlockedByRelation(rel: RelatedIssue): boolean {
  return /is blocked by/i.test(rel.relationship);
}

export function isBlocksRelation(rel: RelatedIssue): boolean {
  return /^blocks$/i.test(rel.relationship.trim());
}

export function relatedLinks(issue: JiraIssue, siteUrl: string | undefined): RelatedIssue[] {
  return (issue.fields?.issuelinks ?? [])
    .map((l) => linkToRelated(l, siteUrl))
    .filter((r): r is RelatedIssue => !!r);
}

export { toPerson };
