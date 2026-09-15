import { useEffect, useRef, useState } from 'react';

/**
 * Returns live backend data when it arrives, else the mock passed in.
 * Renders instantly from `mock`, swaps to `live` on success, and falls back to
 * `mock` on any error — so a view is never blank and never breaks if the
 * backend is down. `fetcher` may resolve `null` to mean "no live value".
 */
export function useLiveOrMock<T>(fetcher: () => Promise<T | null>, mock: T, deps: unknown[]): T {
  const [live, setLive] = useState<T | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((r) => { if (!cancelled) setLive(r); })
      .catch(() => { if (!cancelled) setLive(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return live ?? mock;
}

/** Debounce a rapidly-changing value (e.g. a slider) before firing requests. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    t.current = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t.current);
  }, [value, ms]);
  return v;
}
