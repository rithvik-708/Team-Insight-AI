/**
 * Normalised domain types shared by actions, the dashboard resolver and the Rovo/MCP handlers.
 * Everything here is produced from live Jira / Teamwork Graph responses — never fabricated.
 */

export type StatusCategory = 'todo' | 'in_progress' | 'done' | 'unknown';

/** Where a piece of data came from. Surfaced to users so provenance is always explicit. */
export type DataSourceName = 'teamworkGraph' | 'jira' | 'confluence';

export interface SourceReport {
  source: DataSourceName;
  /** What the source was used for, e.g. "assigned work items". */
  purpose: string;
  status: 'ok' | 'empty' | 'unavailable' | 'error';
  detail?: string;
}

export interface PersonRef {
  accountId?: string;
  displayName: string;
}

export interface ProjectRef {
  key: string;
  name?: string;
  id?: string;
}

export interface WorkItem {
  key: string;
  summary: string;
  url?: string;
  status: string;
  statusCategory: StatusCategory;
  priority?: string;
  issueType?: string;
  project?: ProjectRef;
  assignee?: PersonRef;
  dueDate?: string;
  updated?: string;
  isOverdue: boolean;
  source: DataSourceName;
}

export interface FocusSuggestion {
  key: string;
  summary: string;
  url?: string;
  reasons: string[];
}

export interface MyWorkResult {
  user: PersonRef;
  totals: {
    open: number;
    highPriority: number;
    overdue: number;
    inProgress: number;
  };
  items: WorkItem[];
  /** Deterministic recommendation — explicitly a suggestion, not a fact. */
  suggestedFocus: FocusSuggestion[];
  truncated: boolean;
  sources: SourceReport[];
  notes: string[];
}

export interface TeamRef {
  id: string;
  name: string;
  description?: string;
  url?: string;
}

export interface MemberWorkload {
  accountId: string;
  displayName: string;
  openCount: number;
  inProgressCount: number;
  todoCount: number;
  highPriorityCount: number;
  overdueCount: number;
  topItems: WorkItem[];
  loadFlag: 'high' | 'none' | 'normal';
}

export type TeamWorkloadResult =
  | {
      status: 'ok';
      scope: { kind: 'team'; team: TeamRef } | { kind: 'project'; project: ProjectRef };
      members: MemberWorkload[];
      totals: {
        open: number;
        members: number;
        averagePerMember: number;
        statusDistribution: Record<string, number>;
        unassignedOpen?: number;
      };
      highLoadMembers: string[];
      membersWithoutWork: string[];
      topPriorityItems: WorkItem[];
      truncated: boolean;
      disclaimer: string;
      sources: SourceReport[];
      notes: string[];
    }
  | {
      status: 'needs_team_selection';
      teams: TeamRef[];
      message: string;
      sources: SourceReport[];
    }
  | {
      status: 'no_team';
      message: string;
      teams: TeamRef[];
      sources: SourceReport[];
    };

export interface CommenterSummary extends PersonRef {
  commentCount: number;
  lastCommentAt?: string;
}

export interface ContactSuggestion {
  displayName: string;
  accountId?: string;
  reason: string;
}

export interface IssueSummary {
  key: string;
  summary: string;
  url?: string;
  status: string;
  statusCategory: StatusCategory;
  priority?: string;
  issueType?: string;
  project?: ProjectRef;
}

export interface IssuePeopleResult {
  issue: IssueSummary;
  assignee?: PersonRef;
  reporter?: PersonRef;
  creator?: PersonRef;
  commenters: CommenterSummary[];
  watchers: { status: 'ok' | 'unavailable'; count?: number; people: PersonRef[] };
  teams: TeamRef[];
  linkedIssueCount: number;
  suggestedContacts: ContactSuggestion[];
  sources: SourceReport[];
  notes: string[];
}

export interface RelatedIssue extends IssueSummary {
  relationship: string;
  direction?: 'inward' | 'outward';
  assignee?: PersonRef;
  source: DataSourceName;
}

export interface RelatedWorkResult {
  issue: IssueSummary;
  parent?: RelatedIssue;
  children: RelatedIssue[];
  links: RelatedIssue[];
  blockedBy: RelatedIssue[];
  blocks: RelatedIssue[];
  isBlocked: boolean;
  remoteLinks: { title: string; url: string; application?: string }[];
  sources: SourceReport[];
  notes: string[];
}

export interface BlockedItem extends WorkItem {
  blockers: RelatedIssue[];
  /** True when every blocker is already Done — the link may be stale. */
  allBlockersResolved: boolean;
}

export interface BlockedWorkResult {
  scope: { kind: 'mine' } | { kind: 'project'; projectKey: string };
  items: BlockedItem[];
  truncated: boolean;
  sources: SourceReport[];
  notes: string[];
}

export interface RelatedDocument {
  title: string;
  url: string;
  excerpt?: string;
  space?: string;
  lastModified?: string;
  via: 'jira_remote_link' | 'confluence_search';
}

export interface RelatedDocsResult {
  query?: string;
  issue?: IssueSummary;
  documents: RelatedDocument[];
  sources: SourceReport[];
  notes: string[];
}
