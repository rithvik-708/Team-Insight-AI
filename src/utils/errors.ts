/**
 * Application error model. Every failure crossing a module boundary becomes an AppError with a
 * stable code and a user-safe message. Raw upstream bodies, stack traces and tokens are never
 * placed in `userMessage`.
 */
export type ErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'AUTH_REQUIRED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UNSUPPORTED'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL';

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT: 'The request was not valid.',
  NOT_FOUND: 'The requested item was not found, or you do not have permission to view it.',
  PERMISSION_DENIED: 'You do not have permission to view this information.',
  AUTH_REQUIRED:
    'Teamwork Insight needs your consent to access Atlassian data on your behalf. Open the app once in Jira and allow access, then try again.',
  RATE_LIMITED: 'Atlassian is rate-limiting requests right now. Please try again in a minute.',
  TIMEOUT: 'The request to Atlassian took too long. Please try again.',
  UNSUPPORTED: 'This capability is not available on this site.',
  UPSTREAM_ERROR: 'An Atlassian service returned an unexpected error.',
  INTERNAL: 'Something went wrong inside Teamwork Insight.',
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly userMessage: string;
  readonly status?: number;

  constructor(
    code: ErrorCode,
    userMessage?: string,
    options?: { status?: number; cause?: unknown },
  ) {
    super(userMessage ?? DEFAULT_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage ?? DEFAULT_MESSAGES[code];
    this.status = options?.status;
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/** Maps an HTTP status from an Atlassian API onto an AppError. */
export function errorFromStatus(status: number, context: string): AppError {
  if (status === 400)
    return new AppError('INVALID_INPUT', `Atlassian rejected the ${context} request.`, { status });
  if (status === 401) return new AppError('AUTH_REQUIRED', undefined, { status });
  if (status === 403) return new AppError('PERMISSION_DENIED', undefined, { status });
  if (status === 404) return new AppError('NOT_FOUND', undefined, { status });
  if (status === 429) return new AppError('RATE_LIMITED', undefined, { status });
  if (status === 408 || status === 504) return new AppError('TIMEOUT', undefined, { status });
  return new AppError('UPSTREAM_ERROR', `The ${context} request failed (HTTP ${status}).`, {
    status,
  });
}

/**
 * Normalises anything thrown into an AppError. Forge throws a `NeedsAuthenticationError` when an
 * `asUser()` call has no user consent (common for remote MCP clients). We map that to
 * AUTH_REQUIRED instead of silently falling back to `asApp()`, which would bypass user permissions.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const name = (err as { name?: string } | null)?.name ?? '';
  if (/NeedsAuthentication/i.test(name))
    return new AppError('AUTH_REQUIRED', undefined, { cause: err });
  if (/Timeout|AbortError/i.test(name)) return new AppError('TIMEOUT', undefined, { cause: err });
  return new AppError('INTERNAL', undefined, { cause: err });
}

export interface ErrorPayload {
  ok: false;
  error: { code: ErrorCode; message: string };
}

export function toErrorPayload(err: unknown): ErrorPayload {
  const appError = toAppError(err);
  return { ok: false, error: { code: appError.code, message: appError.userMessage } };
}

/** Short, user-safe description of a failure, used in per-source status reports. */
export function describeFailure(err: unknown): string {
  return toAppError(err).userMessage;
}
