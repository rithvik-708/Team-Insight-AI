/**
 * Teamwork Graph curated queries. Every field and argument below was verified against the official
 * docs (developer.atlassian.com/platform/teamwork-graph/curated-queries and the object type
 * reference pages for JiraWorkItem, AtlassianUser, AtlassianTeam and JiraWorkItemComment).
 *
 * - Curated query fields return Relay connections: edges { node } + pageInfo.
 * - `node` is a union, so concrete types are selected with inline fragments.
 * - `first` is capped at 25 (requesting more is an error).
 * - Each object type traversed needs its read:graph scope, otherwise rows are silently omitted.
 */

export const GRAPH_PAGE_SIZE = 25;

/** Documented connectivity check: `echo(myString: ...)`. */
export const ECHO_QUERY = `
query teamworkInsight_echo($value: String!) {
  echo(myString: $value)
}`;

/** Scopes: read:graph:user:atlassian, read:graph:issue:jira, read:graph:issue-status:jira */
export const ASSIGNED_WORK_ITEMS_QUERY = `
query teamworkInsight_assignedWorkItems($userId: ID!, $first: Int, $after: String) {
  atlassianUserAssignedJiraWorkItems(userId: $userId, first: $first, after: $after) {
    edges {
      node {
        __typename
        ... on JiraWorkItem {
          id
          issueId
          key
          summary
          webUrl
          dueAt
          status {
            name
            statusCategory {
              key
            }
          }
          issueType {
            name
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

/** Scopes: read:graph:user:atlassian, read:graph:team:atlassian */
export const USER_TEAMS_QUERY = `
query teamworkInsight_userTeams($userId: ID!, $first: Int, $after: String) {
  atlassianUserInTeams(userId: $userId, first: $first, after: $after) {
    edges {
      node {
        __typename
        ... on AtlassianTeam {
          id
          displayName
          description
          profileUrl
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

/** Scopes: read:graph:team:atlassian, read:graph:user:atlassian */
export const TEAM_MEMBERS_QUERY = `
query teamworkInsight_teamMembers($teamAri: ID!, $first: Int, $after: String) {
  atlassianTeamMembers(teamAri: $teamAri, first: $first, after: $after) {
    edges {
      node {
        __typename
        ... on AtlassianUser {
          id
          accountId
          name
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

/** Scopes: read:graph:project:jira (Jira spaces), read:graph:team:atlassian */
export const TEAMS_BY_SPACE_QUERY = `
query teamworkInsight_teamsBySpace($spaceAri: ID!, $first: Int, $after: String) {
  atlassianTeamsBySpace(spaceAri: $spaceAri, first: $first, after: $after) {
    edges {
      node {
        __typename
        ... on AtlassianTeam {
          id
          displayName
          description
          profileUrl
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

/**
 * Scopes: read:graph:issue:jira, read:graph:issue-comment:jira, read:graph:user:atlassian
 * `since` is an ISO-8601 duration (default P30D on the server).
 */
export const WORK_ITEM_COMMENTS_QUERY = `
query teamworkInsight_workItemComments($id: ID!, $since: String!, $first: Int, $after: String) {
  jiraWorkItemComments(id: $id, since: $since, first: $first, after: $after) {
    edges {
      node {
        __typename
        ... on JiraWorkItemComment {
          id
          createdAt
          deleted
          author {
            name
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;
