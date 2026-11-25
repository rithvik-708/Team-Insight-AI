import { AppError, errorFromStatus, toAppError, toErrorPayload } from '../../src/utils/errors';
import {
  parseIssueKey,
  parseOptionalBoolean,
  parseOptionalInt,
  parseOptionalIssueKey,
  parseOptionalProjectKey,
  parseOptionalTeamAri,
  parseOptionalText,
  quoteQueryString,
} from '../../src/utils/validation';

describe('parseIssueKey', () => {
  it('accepts and normalises valid keys', () => {
    expect(parseIssueKey('MKT-21')).toBe('MKT-21');
    expect(parseIssueKey(' mkt-21 ')).toBe('MKT-21');
    expect(parseIssueKey('AB_C2-9')).toBe('AB_C2-9');
  });
  it('extracts a key from a Jira browse URL', () => {
    expect(parseIssueKey('https://x.atlassian.net/browse/mkt-7?focusedCommentId=1')).toBe('MKT-7');
  });
  it('rejects invalid keys with INVALID_INPUT', () => {
    for (const bad of ['', 'MKT', '21', 'MKT-0', 'MKT-21; DROP', '-1', 'mkt 21']) {
      expect(() => parseIssueKey(bad)).toThrow(AppError);
    }
    try {
      parseIssueKey('nope');
    } catch (e) {
      expect((e as AppError).code).toBe('INVALID_INPUT');
    }
  });
  it('treats absent optional keys as undefined', () => {
    expect(parseOptionalIssueKey(undefined)).toBeUndefined();
    expect(parseOptionalIssueKey('  ')).toBeUndefined();
    expect(parseOptionalIssueKey('mkt-3')).toBe('MKT-3');
  });
});

describe('other parsers', () => {
  it('parses project keys', () => {
    expect(parseOptionalProjectKey('mkt')).toBe('MKT');
    expect(parseOptionalProjectKey(undefined)).toBeUndefined();
    expect(() => parseOptionalProjectKey('MKT"OR 1=1')).toThrow(AppError);
  });
  it('parses and clamps integers, including string inputs from Rovo', () => {
    const opts = { min: 1, max: 25, fallback: 10 };
    expect(parseOptionalInt(undefined, opts)).toBe(10);
    expect(parseOptionalInt('5', opts)).toBe(5);
    expect(parseOptionalInt(100, opts)).toBe(25);
    expect(parseOptionalInt(-3, opts)).toBe(1);
    expect(parseOptionalInt('7.9', opts)).toBe(7);
    expect(() => parseOptionalInt('ten', opts)).toThrow(AppError);
  });
  it('parses loose booleans', () => {
    expect(parseOptionalBoolean('true')).toBe(true);
    expect(parseOptionalBoolean('Yes')).toBe(true);
    expect(parseOptionalBoolean(false, true)).toBe(false);
    expect(parseOptionalBoolean('no', true)).toBe(false);
    expect(parseOptionalBoolean('maybe', true)).toBe(true);
    expect(parseOptionalBoolean(undefined)).toBe(false);
  });
  it('cleans free text', () => {
    expect(parseOptionalText('  hello\u0000world  ')).toBe('hello world');
    expect(parseOptionalText('x'.repeat(500), 10)).toHaveLength(10);
    expect(parseOptionalText('   ')).toBeUndefined();
    expect(parseOptionalText({})).toBeUndefined();
  });
  it('normalises team identifiers to ARIs', () => {
    const uuid = '19441f6d-f53e-4e35-a89f-265a30db4e68';
    expect(parseOptionalTeamAri(uuid)).toBe(`ari:cloud:identity::team/${uuid}`);
    expect(parseOptionalTeamAri(`ari:cloud:identity::team/${uuid}`)).toBe(
      `ari:cloud:identity::team/${uuid}`,
    );
    expect(parseOptionalTeamAri('Platform Team')).toBeUndefined();
    expect(parseOptionalTeamAri('platform')).toBeUndefined();
  });
  it('escapes JQL/CQL string literals', () => {
    expect(quoteQueryString('a "quoted" \\ value')).toBe('"a \\"quoted\\" \\\\ value"');
  });
});

describe('errors', () => {
  it('maps HTTP statuses to codes', () => {
    expect(errorFromStatus(401, 'x').code).toBe('AUTH_REQUIRED');
    expect(errorFromStatus(403, 'x').code).toBe('PERMISSION_DENIED');
    expect(errorFromStatus(404, 'x').code).toBe('NOT_FOUND');
    expect(errorFromStatus(429, 'x').code).toBe('RATE_LIMITED');
    expect(errorFromStatus(504, 'x').code).toBe('TIMEOUT');
    expect(errorFromStatus(500, 'Jira search').userMessage).toContain('HTTP 500');
  });
  it('maps Forge NeedsAuthenticationError to AUTH_REQUIRED', () => {
    const err = Object.assign(new Error('needs auth'), { name: 'NeedsAuthenticationError' });
    expect(toAppError(err).code).toBe('AUTH_REQUIRED');
  });
  it('never exposes raw internal messages', () => {
    const payload = toErrorPayload(new Error('secret token abc123 at line 42'));
    expect(payload).toEqual({
      ok: false,
      error: { code: 'INTERNAL', message: expect.any(String) },
    });
    expect(payload.error.message).not.toContain('abc123');
  });
});
