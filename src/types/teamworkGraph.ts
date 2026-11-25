/** Raw Teamwork Graph GraphQL response shapes (defensive: everything optional). */

export interface GraphError {
  message?: string;
  path?: (string | number)[];
  extensions?: {
    classification?: string;
    statusCode?: number;
    errorType?: string;
    [k: string]: unknown;
  };
}

export interface GraphResponse<T> {
  data?: T | null;
  errors?: GraphError[];
}

export interface PageInfo {
  hasNextPage?: boolean;
  endCursor?: string | null;
}

export interface Connection<N> {
  edges?: ({ node?: N | null } | null)[] | null;
  pageInfo?: PageInfo | null;
}

export interface GraphJiraWorkItem {
  __typename?: string;
  id?: string;
  issueId?: string | null;
  key?: string | null;
  summary?: string | null;
  webUrl?: string | null;
  dueAt?: string | null;
  status?: { name?: string | null; statusCategory?: { key?: string | null } | null } | null;
  issueType?: { name?: string | null } | null;
}

export interface GraphAtlassianTeam {
  __typename?: string;
  id?: string;
  displayName?: string | null;
  description?: string | null;
  profileUrl?: string | null;
}

export interface GraphAtlassianUser {
  __typename?: string;
  id?: string;
  accountId?: string | null;
  name?: string | null;
}

export interface GraphWorkItemComment {
  __typename?: string;
  id?: string;
  createdAt?: string | null;
  deleted?: boolean | null;
  author?: { name?: string | null } | null;
}
