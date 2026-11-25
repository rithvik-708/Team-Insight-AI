import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../services/api';

export interface AsyncState<T> {
  data?: T;
  error?: ApiError;
  loading: boolean;
  reload: () => void;
}

/** Runs an async loader on mount (and when `deps` change), tracking loading / error / data. */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  enabled = true,
): AsyncState<T> {
  const [state, setState] = useState<{ data?: T; error?: ApiError; loading: boolean }>({
    loading: enabled,
  });
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (!enabled) {
      setState({ loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ data: s.data, loading: true }));
    loaderRef
      .current()
      .then((data) => !cancelled && setState({ data, loading: false }))
      .catch((err: unknown) => {
        if (cancelled) return;
        const error =
          err instanceof ApiError ? err : new ApiError('INTERNAL', 'Something went wrong.');
        setState({ error, loading: false });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
