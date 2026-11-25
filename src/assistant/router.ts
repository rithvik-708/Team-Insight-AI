/**
 * Deterministic question router for the dashboard's "Ask" box. This is intentionally *not* an LLM:
 * it maps common phrasings onto the same actions the Rovo agent uses, so answers on the dashboard
 * are always live data. Open-ended questions are handed to the Rovo agent from the UI.
 */
export type Intent =
  | { intent: 'myWork'; projectKey?: string }
  | { intent: 'focus' }
  | { intent: 'teamWorkload'; teamName?: string; projectKey?: string }
  | { intent: 'issuePeople'; issueKey: string }
  | { intent: 'relatedWork'; issueKey: string }
  | { intent: 'relatedDocs'; issueKey?: string; query?: string }
  | { intent: 'blockedWork'; projectKey?: string }
  | { intent: 'needsIssue'; asked: 'issuePeople' | 'relatedWork' }
  | { intent: 'unknown' };

const ISSUE_KEY = /\b([A-Za-z][A-Za-z0-9_]{0,30}-[1-9]\d{0,9})\b/;
const PROJECT_REF = /\bproject\s+([A-Za-z][A-Za-z0-9_]{0,30})\b/i;

function extractTeamName(text: string): string | undefined {
  const quoted =
    text.match(/team\s+["']([^"']{2,60})["']/i) ?? text.match(/["']([^"']{2,60})["']\s+team/i);
  if (quoted) return quoted[1].trim();
  const named = text.match(/\b(?:the\s+)?([A-Z][\w-]*(?:\s+[A-Z][\w-]*){0,3})\s+team\b/);
  if (named && !/^(My|Our|The|What|Which|Show|Is|Who)$/i.test(named[1])) return named[1].trim();
  return undefined;
}

export function routeQuestion(raw: string, contextIssueKey?: string): Intent {
  const text = raw.trim().slice(0, 300);
  if (!text) return { intent: 'unknown' };
  const lower = text.toLowerCase();
  const issueKey = text.match(ISSUE_KEY)?.[1]?.toUpperCase() ?? contextIssueKey;
  const projectKey = text.match(PROJECT_REF)?.[1]?.toUpperCase();

  if (
    /\b(doc|docs|document|documents|documentation|confluence|spec|specs|page|pages|wiki)\b/.test(
      lower,
    )
  ) {
    const about = text.match(/\b(?:about|for|on)\s+["']?([^"'?]{3,80})["']?\??$/i)?.[1];
    if (issueKey) return { intent: 'relatedDocs', issueKey };
    if (about) return { intent: 'relatedDocs', query: about.trim() };
    return { intent: 'relatedDocs', query: text.replace(/[?]/g, '') };
  }

  const wantsPeople =
    /\b(who|people|involved|owner|owns|assignee|reporter|contact|participants?)\b/.test(lower);
  const wantsRelated =
    /\b(related|relat|link|linked|links|depend|dependency|dependencies|parent|child|children|subtasks?|epic)\b/.test(
      lower,
    );

  if (/\bblock(ed|ers?|ing)?\b/.test(lower) && !issueKey) {
    return { intent: 'blockedWork', projectKey };
  }
  if (wantsRelated || (/\bblock/.test(lower) && issueKey)) {
    return issueKey
      ? { intent: 'relatedWork', issueKey }
      : { intent: 'needsIssue', asked: 'relatedWork' };
  }
  if (wantsPeople && !/\bteam\b/.test(lower)) {
    return issueKey
      ? { intent: 'issuePeople', issueKey }
      : { intent: 'needsIssue', asked: 'issuePeople' };
  }
  if (/\b(team|teams|teammates?|workload|capacity|everyone)\b/.test(lower)) {
    return { intent: 'teamWorkload', teamName: extractTeamName(text), projectKey };
  }
  if (/\b(focus|next|prioriti[sz]e|start on|work on first)\b/.test(lower)) {
    return { intent: 'focus' };
  }
  const aboutMe = /\b(my|me|i|mine|i'm)\b/.test(lower);
  const aboutWork = /\b(work|working|issues?|tasks?|tickets?|plate|backlog)\b/.test(lower);
  if (/\b(assigned|outstanding|todo|to do|overdue)\b/.test(lower) || (aboutMe && aboutWork)) {
    return { intent: 'myWork', projectKey };
  }
  if (issueKey) return { intent: 'issuePeople', issueKey };
  return { intent: 'unknown' };
}
