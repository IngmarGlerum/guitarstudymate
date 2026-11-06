import { useCallback, useState } from 'react';

/**
 * State remembered in localStorage, for per-browser conveniences only. Reading or
 * writing may fail (private mode, blocked storage); the app then simply forgets.
 */
export function useStoredState<T>(key: string, initial: T, valid: (v: unknown) => v is T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (valid(parsed)) return parsed;
      }
    } catch {
      // fall through to the default
    }
    return initial;
  });
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // not remembered this time
      }
    },
    [key],
  );
  return [value, set] as const;
}
