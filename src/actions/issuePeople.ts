import { getSiteUrl } from '../services/jira/client';
import {
  getIssueComments,
  getIssueWatchers,
  toIssueSummary,
  toPerson,
} from '../services/jira/issues';
import { getTeamsForProject } from '../services/teamworkGraph/teams';
import {
  getWorkItemCommentAuthors,
  type GraphCommentAuthor,
} from '../services/teamworkGraph/workItems';
import { describeFailure } from '../utils/errors';
import { loadIssueDetail } from './shared';
import type { RequestContext } from '../types/actions';
import type { JiraComment } from '../types/jira';
import type {
  CommenterSummary,
  ContactSuggestion,
  IssuePeopleResult,
  PersonRef,
  SourceReport,
  TeamRef,
} from '../types/domain';

type Settled<T> = { ok: true; value: T } | { ok: false; err: unknown };
const settle = <T>(p: Promise<T>): Promise<Settled<T>> =>
  p.then(
    (value) => ({ ok: true as const, value }),
    (err: unknown) => ({ ok: false as const, err }),
  );

/**
 * "Who is involved in MKT-21?" Ownership (assignee, reporter) comes from Jira; discussion
 * participants come from Jira comments and Teamwork Graph (`jiraWorkItemComments`); teams linked to
 * the project come from Teamwork Graph (`atlassianTeamsBySpace`). All calls run as the user, so an
 * issue they cannot see yields NOT_FOUND rather than leaking its existence.
 */
export async function issuePeople(
  ctx: RequestContext,
  issueKey: string,
): Promise<IssuePeopleResult> {
  const [issue, siteUrl] = await Promise.all([loadIssueDetail(issueKey), getSiteUrl()]);
  const f = issue.fields ?? {};
  const sources: SourceReport[] = [
    { source: 'jira', purpose: 'assignee, reporter and links', status: 'ok' },
  ];
  const notes: string[] = [];

  const canQueryGraph = !!ctx.cloudId && !!issue.id;
  const [comments, watchers, graphAuthors, graphTeams] = await Promise.all([
    settle(getIssueComments(issueKey)),
    settle(getIssueWatchers(issueKey)),
    canQueryGraph
      ? settle(getWorkItemCommentAuthors(ctx.cloudId!, issue.id!))
      : Promise.resolve(undefined),
    canQueryGraph && f.project?.id
      ? settle(getTeamsForProject(ctx.cloudId!, f.project.id))
      : Promise.resolve(undefined),
  ]);

  const jiraComments = comments.ok ? (comments.value.comments ?? []) : [];
  if (!comments.ok) {
    sources.push({
      source: 'jira',
      purpose: 'comments',
      status: 'error',
      detail: describeFailure(comments.err),
    });
  } else if ((comments.value.total ?? 0) > jiraComments.length) {
    notes.push(
      `Only the latest ${jiraComments.length} of ${comments.value.total} comments were scanned.`,
    );
  }

  if (graphAuthors === undefined) {
    notes.push('Teamwork Graph comment and team lookups were skipped (site context unavailable).');
  } else if (graphAuthors.ok) {
    sources.push({
      source: 'teamworkGraph',
      purpose: 'recent comment authors, last 90 days (jiraWorkItemComments)',
      status: graphAuthors.value.length > 0 ? 'ok' : 'empty',
    });
  } else {
    sources.push({
      source: 'teamworkGraph',
      purpose: 'recent comment authors (jiraWorkItemComments)',
      status: 'error',
      detail: describeFailure(graphAuthors.err),
    });
  }

  let teams: TeamRef[] = [];
  if (graphTeams?.ok) {
    teams = graphTeams.value;
    sources.push({
      source: 'teamworkGraph',
      purpose: 'teams linked to the project (atlassianTeamsBySpace)',
      status: teams.length > 0 ? 'ok' : 'empty',
    });
  } else if (graphTeams && !graphTeams.ok) {
    sources.push({
      source: 'teamworkGraph',
      purpose: 'teams linked to the project (atlassianTeamsBySpace)',
      status: 'error',
      detail: describeFailure(graphTeams.err),
    });
  }

  const commenters = mergeCommenters(jiraComments, graphAuthors?.ok ? graphAuthors.value : []);
  const assignee = toPerson(f.assignee);
  const reporter = toPerson(f.reporter);
  const creator = toPerson(f.creator);

  let watcherInfo: IssuePeopleResult['watchers'] = { status: 'unavailable', people: [] };
  if (watchers.ok) {
    watcherInfo = {
      status: 'ok',
      count: watchers.value.watchCount ?? watchers.value.watchers?.length ?? 0,
      people: (watchers.value.watchers ?? []).map(toPerson).filter((p): p is PersonRef => !!p),
    };
  } else {
    notes.push(
      'Watchers are not visible to you (Jira requires the "View voters and watchers" permission).',
    );
  }

  const linkedIssueCount =
    (f.issuelinks?.length ?? 0) + (f.subtasks?.length ?? 0) + (f.parent?.key ? 1 : 0);

  return {
    issue: toIssueSummary(issue, siteUrl),
    assignee,
    reporter,
    creator: creator && creator.accountId !== reporter?.accountId ? creator : undefined,
    commenters,
    watchers: watcherInfo,
    teams,
    linkedIssueCount,
    suggestedContacts: suggestContacts(assignee, reporter, commenters),
    sources,
    notes,
  };
}

/** Jira comments carry account IDs; Graph authors carry names only, so they are matched by name. */
export function mergeCommenters(
  jiraComments: JiraComment[],
  graphAuthors: GraphCommentAuthor[],
): CommenterSummary[] {
  const byKey = new Map<string, CommenterSummary>();
  for (const c of jiraComments) {
    const name = c.author?.displayName;
    if (!name) continue;
    const key = c.author?.accountId ?? `name:${name}`;
    const entry = byKey.get(key) ?? {
      accountId: c.author?.accountId,
      displayName: name,
      commentCount: 0,
    };
    entry.commentCount += 1;
    if (c.created && (!entry.lastCommentAt || c.created > entry.lastCommentAt)) {
      entry.lastCommentAt = c.created;
    }
    byKey.set(key, entry);
  }
  const knownNames = new Set([...byKey.values()].map((c) => c.displayName.toLowerCase()));
  for (const g of graphAuthors) {
    if (knownNames.has(g.displayName.toLowerCase())) continue;
    byKey.set(`graph:${g.displayName}`, { ...g });
  }
  return [...byKey.values()].sort(
    (a, b) =>
      b.commentCount - a.commentCount ||
      (b.lastCommentAt ?? '').localeCompare(a.lastCommentAt ?? ''),
  );
}

/** Contact suggestions state *why* each person is listed; commenting never implies ownership. */
export function suggestContacts(
  assignee: PersonRef | undefined,
  reporter: PersonRef | undefined,
  commenters: CommenterSummary[],
): ContactSuggestion[] {
  const out: ContactSuggestion[] = [];
  const seen = new Set<string>();
  const add = (p: PersonRef, reason: string) => {
    const key = p.accountId ?? p.displayName;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ displayName: p.displayName, accountId: p.accountId, reason });
  };
  if (assignee) add(assignee, 'Assignee: currently owns this issue');
  if (reporter) add(reporter, 'Reporter: raised the issue and can clarify the requirement');
  for (const c of commenters.slice(0, 3)) {
    add(
      c,
      `Active in the discussion (${c.commentCount} comment${c.commentCount === 1 ? '' : 's'}); not necessarily responsible`,
    );
  }
  return out.slice(0, 5);
}
