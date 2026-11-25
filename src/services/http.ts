import { AppError, errorFromStatus, toAppError } from '../utils/errors';

/** Forge function invocations time out at 25s; individual upstream calls get a smaller budget. */
export const UPSTREAM_TIMEOUT_MS = 12_000;

export interface MinimalResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/**
 * Bounds an upstream promise by a timeout. Forge's product fetch doesn't expose cancellation, so
 * the request is abandoned (not aborted). All callers are read-only GETs/queries, so abandoning is
 * safe and nothing is retried automatically.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  ms = UPSTREAM_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new AppError('TIMEOUT', `The ${label} request timed out.`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Executes a request and returns parsed JSON, mapping non-2xx statuses onto AppErrors. */
export async function requestJson<T>(
  label: string,
  doRequest: () => Promise<MinimalResponse>,
): Promise<T> {
  let response: MinimalResponse;
  try {
    response = await withTimeout(doRequest(), label);
  } catch (err) {
    throw toAppError(err);
  }
  if (!response.ok) throw errorFromStatus(response.status, label);
  if (response.status === 204) return {} as T;
  try {
    return (await response.json()) as T;
  } catch (err) {
    throw new AppError('UPSTREAM_ERROR', `The ${label} response could not be read.`, {
      cause: err,
    });
  }
}
