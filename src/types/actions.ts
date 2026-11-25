/**
 * The invocation context every business action receives. Identity always comes from the Forge
 * runtime context, never from user-supplied inputs (per Forge guidance, inputs must not be used
 * for authorization decisions).
 */
export interface RequestContext {
  accountId: string;
  /** Site cloud ID, required to build Jira ARIs for Teamwork Graph queries. */
  cloudId?: string;
  /** Issue key from the surrounding Jira context (e.g. Rovo opened on an issue view). */
  contextIssueKey?: string;
  /** Project key from the surrounding Jira context. */
  contextProjectKey?: string;
}

/** Rovo action payloads carry the input values plus an optional product context block. */
export interface RovoActionPayload {
  [input: string]: unknown;
  context?: {
    cloudId?: string;
    moduleKey?: string;
    jira?: { issueKey?: string; issueId?: string; projectKey?: string; url?: string };
    confluence?: { contentId?: string; spaceKey?: string };
  };
}
