import { useCallback, useState } from 'react';
import type { GridDivision } from './drawing';

export interface ViewPrefs {
  timeRuler: boolean;
  barRuler: boolean;
  division: GridDivision;
}

const DEFAULT_PREFS: ViewPrefs = { timeRuler: true, barRuler: false, division: 4 };
const STORAGE_KEY = 'gsm.view';

export const DIVISIONS: { value: GridDivision; label: string }[] = [
  { value: 4, label: 'Kwarten' },
  { value: 8, label: 'Achtsten' },
  { value: 16, label: 'Zestienden' },
];

function readPrefs(): ViewPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<ViewPrefs>;
    const division = DIVISIONS.some((d) => d.value === p.division)
      ? (p.division as GridDivision)
      : DEFAULT_PREFS.division;
    const timeRuler = p.timeRuler !== false;
    const barRuler = p.barRuler === true;
    // at least one ruler, so the loop locators always have a home
    return { timeRuler: timeRuler || !barRuler, barRuler, division };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Ruler and grid choices, remembered per browser (a convenience, never required). */
export function useViewPrefs() {
  const [prefs, setPrefs] = useState<ViewPrefs>(readPrefs);
  const update = useCallback((patch: Partial<ViewPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      if (!next.timeRuler && !next.barRuler) return prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable: keep the choice for this visit only
      }
      return next;
    });
  }, []);
  return [prefs, update] as const;
}

