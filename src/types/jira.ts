/**
 * Raw Jira Cloud REST v3 response shapes — only the fields we read. All fields are optional
 * because responses are parsed defensively (field-level permissions can hide any of them).
 */

export interface JiraUser {
  accountId?: string;
  displayName?: string;
  active?: boolean;
}

export interface JiraStatus {
  name?: string;
  statusCategory?: { key?: string; name?: string };
}

export interface JiraLinkedIssue {
  id?: string;
  key?: string;
  fields?: {
    summary?: string;
    status?: JiraStatus;
    priority?: { name?: string };
    issuetype?: { name?: string };
  };
}

export interface JiraIssueLink {
  id?: string;
  type?: { name?: string; inward?: string; outward?: string };
  inwardIssue?: JiraLinkedIssue;
  outwardIssue?: JiraLinkedIssue;
}

export interface JiraIssueFields {
  summary?: string;
  status?: JiraStatus;
  priority?: { name?: string } | null;
  issuetype?: { name?: string; subtask?: boolean };
  project?: { id?: string; key?: string; name?: string };
  assignee?: JiraUser | null;
  reporter?: JiraUser | null;
  creator?: JiraUser | null;
  duedate?: string | null;
  updated?: string;
  parent?: JiraLinkedIssue;
  subtasks?: JiraLinkedIssue[];
  issuelinks?: JiraIssueLink[];
}

export interface JiraIssue {
  id?: string;
  key?: string;
  fields?: JiraIssueFields;
}

export interface JiraSearchResponse {
  issues?: JiraIssue[];
  nextPageToken?: string;
  isLast?: boolean;
}

export interface JiraComment {
  id?: string;
  author?: JiraUser;
  created?: string;
  updated?: string;
}

export interface JiraCommentPage {
  comments?: JiraComment[];
  total?: number;
}

export interface JiraWatchers {
  watchCount?: number;
  watchers?: JiraUser[];
}

export interface JiraRemoteLink {
  id?: number;
  application?: { name?: string; type?: string };
  relationship?: string;
  object?: { title?: string; url?: string; summary?: string };
}

export interface JiraServerInfo {
  baseUrl?: string;
  displayUrl?: string;
  displayUrlConfluence?: string;
}
