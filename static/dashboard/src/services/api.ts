import { invoke, router, rovo } from '@forge/bridge';
import type {
  BlockedWorkResult,
  IssuePeopleResult,
  MyWorkResult,
  RelatedDocsResult,
  RelatedWorkResult,
  TeamRef,
  TeamWorkloadResult,
} from '../../../../src/types/domain';

export type * from '../../../../src/types/domain';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

/** Calls a resolver function and unwraps the `{ ok, data | error }` envelope. */
async function call<T>(fn: string, payload: Record<string, unknown> = {}): Promise<T> {
  let res: Envelope<T> | undefined;
  try {
    // Without the `metadata` argument, invoke resolves to the plain resolver return value.
    res = (await invoke<Envelope<T>>(fn, payload)) as Envelope<T>;
  } catch {
    throw new ApiError(
      'NETWORK',
      'Could not reach the Teamwork Insight backend. Check your connection and try again.',
    );
  }
  if (!res || typeof res !== 'object')
    throw new ApiError('INTERNAL', 'Unexpected response from the backend.');
  if (!res.ok) throw new ApiError(res.error.code, res.error.message);
  return res.data;
}

export interface StatusInfo {
  teamworkGraph: { status: 'connected' | 'degraded' | 'unavailable'; detail?: string };
  siteUrl?: string;
}

export interface IssueContext {
  people: IssuePeopleResult;
  related: RelatedWorkResult;
}

export type AskResponse =
  | { intent: 'myWork' | 'focus'; result: MyWorkResult }
  | { intent: 'teamWorkload'; result: TeamWorkloadResult }
  | { intent: 'issuePeople'; result: IssuePeopleResult }
  | { intent: 'relatedWork'; result: RelatedWorkResult }
  | { intent: 'relatedDocs'; result: RelatedDocsResult }
  | { intent: 'blockedWork'; result: BlockedWorkResult }
  | { intent: 'needsIssue'; asked: 'issuePeople' | 'relatedWork' }
  | { intent: 'unknown' };

export const api = {
  getStatus: () => call<StatusInfo>('getStatus'),
  getMyWork: () => call<MyWorkResult>('getMyWork'),
  getMyTeams: () => call<{ teams: TeamRef[]; hasMore: boolean }>('getMyTeams'),
  getTeamWorkload: (args: { teamId?: string; projectKey?: string }) =>
    call<TeamWorkloadResult>('getTeamWorkload', args),
  getIssueContext: (issueKey: string) => call<IssueContext>('getIssueContext', { issueKey }),
  getRelatedDocs: (args: { issueKey?: string; query?: string }) =>
    call<RelatedDocsResult>('getRelatedDocs', args),
  ask: (question: string) => call<AskResponse>('ask', { question }),
};

/** Custom UI runs in an iframe: links must go through the bridge router to open correctly. */
export function openLink(url: string | undefined): void {
  if (url) void router.open(url);
}

export const AGENT = { key: 'context-guide', name: 'Teamwork Insight Context Guide' } as const;

export async function isRovoEnabled(): Promise<boolean> {
  try {
    return await rovo.isEnabled();
  } catch {
    return false;
  }
}

/** Opens the app's own Rovo agent with an optional pre-filled prompt. */
export async function askRovo(prompt?: string): Promise<void> {
  await rovo.open({ type: 'forge', agentKey: AGENT.key, agentName: AGENT.name, prompt });
}
