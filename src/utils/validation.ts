import { AppError } from './errors';

/**
 * Input validation for Rovo actions, MCP tools and resolver calls. Rovo may pass every input as a
 * string (LLM-filled), so parsers accept loose forms ("true", " 10 ") and normalise them.
 */

const ISSUE_KEY = /^[A-Z][A-Z0-9_]{0,254}-[1-9][0-9]{0,9}$/;
const PROJECT_KEY = /^[A-Z][A-Z0-9_]{0,254}$/;
const TEAM_ARI = /^ari:cloud:identity::team\/[A-Za-z0-9-]{1,64}$/;
const TEAM_UUID = /^[A-Za-z0-9-]{8,64}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function asTrimmedString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const s = String(value).trim();
  return s.length === 0 ? undefined : s;
}

/** Extracts and validates an issue key. Accepts lowercase and keys embedded in a Jira URL. */
export function parseIssueKey(value: unknown, field = 'issueKey'): string {
  const raw = asTrimmedString(value);
  if (!raw) {
    throw new AppError(
      'INVALID_INPUT',
      `Please provide a Jira issue key (for example MKT-21) for "${field}".`,
    );
  }
  const fromUrl = raw.match(/\/browse\/([A-Za-z][A-Za-z0-9_]*-\d+)/);
  const candidate = (fromUrl ? fromUrl[1] : raw).toUpperCase();
  if (!ISSUE_KEY.test(candidate)) {
    throw new AppError(
      'INVALID_INPUT',
      `"${raw.slice(0, 40)}" is not a valid Jira issue key (expected something like MKT-21).`,
    );
  }
  return candidate;
}

export function parseOptionalIssueKey(value: unknown): string | undefined {
  return asTrimmedString(value) === undefined ? undefined : parseIssueKey(value);
}

export function parseOptionalProjectKey(value: unknown): string | undefined {
  const raw = asTrimmedString(value);
  if (!raw) return undefined;
  const key = raw.toUpperCase();
  if (!PROJECT_KEY.test(key)) {
    throw new AppError('INVALID_INPUT', `"${raw.slice(0, 40)}" is not a valid Jira project key.`);
  }
  return key;
}

export function parseOptionalInt(
  value: unknown,
  opts: { min: number; max: number; fallback: number },
): number {
  const raw = asTrimmedString(value);
  if (raw === undefined) return opts.fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new AppError('INVALID_INPUT', `"${raw.slice(0, 20)}" is not a number.`);
  }
  return Math.min(opts.max, Math.max(opts.min, Math.trunc(n)));
}

export function parseOptionalBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  const raw = asTrimmedString(value)?.toLowerCase();
  if (raw === undefined) return fallback;
  if (['true', 'yes', '1', 'y'].includes(raw)) return true;
  if (['false', 'no', '0', 'n'].includes(raw)) return false;
  return fallback;
}

export function parseOptionalText(value: unknown, maxLength = 200): string | undefined {
  const raw = asTrimmedString(value);
  if (raw === undefined) return undefined;
  // Strip control characters and cap length: these values end up in JQL/CQL string literals.
  const cleaned = raw
    .replace(CONTROL_CHARS, ' ')
    .slice(0, maxLength)
    .trim();
  return cleaned.length === 0 ? undefined : cleaned;
}

/** Accepts either a team ARI or a bare team UUID; returns the ARI form, or undefined if absent/invalid. */
export function parseOptionalTeamAri(value: unknown): string | undefined {
  const raw = asTrimmedString(value);
  if (!raw) return undefined;
  if (TEAM_ARI.test(raw)) return raw;
  if (TEAM_UUID.test(raw) && /\d/.test(raw) && raw.includes('-')) {
    return `ari:cloud:identity::team/${raw}`;
  }
  return undefined;
}

/** Escapes a value for use inside a double-quoted JQL or CQL string literal. */
export function quoteQueryString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
