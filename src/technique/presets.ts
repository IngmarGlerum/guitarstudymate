import { useCallback, useState } from 'react';
import type { ExerciseSettings } from './exercise';
import { normalize } from './settings';

export interface Preset {
  id: string;
  name: string;
  settings: ExerciseSettings;
  created: string;
}

const STORAGE_KEY = 'gsm.technique.presets';
const FILE_FORMAT = 'guitar-study-mate/presets';

function read(): Preset[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

/** Keep only well-formed presets, with settings repaired to something playable. */
function sanitize(value: unknown): Preset[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (p): p is Preset =>
        typeof p === 'object' && p !== null && typeof p.name === 'string' && typeof p.settings === 'object',
    )
    .map((p) => ({
      id: typeof p.id === 'string' ? p.id : crypto.randomUUID(),
      name: p.name.slice(0, 80),
      settings: normalize(p.settings),
      created: typeof p.created === 'string' ? p.created : new Date().toISOString(),
    }));
}

function write(presets: Preset[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    return true;
  } catch {
    return false;
  }
}

/**
 * Presets live in this browser only (localStorage, plain JSON, no account).
 * Export/import is the safety net for another device or cleared browser data.
 */
export function usePresets() {
  const [presets, setPresets] = useState<Preset[]>(read);
  const [saved, setSaved] = useState(true);

  const commit = useCallback((next: Preset[]) => {
    setPresets(next);
    setSaved(write(next));
  }, []);

  const save = useCallback(
    (name: string, settings: ExerciseSettings) => {
      const clean = name.trim().slice(0, 80);
      const existing = presets.find((p) => p.name.toLowerCase() === clean.toLowerCase());
      const preset: Preset = {
        id: existing?.id ?? crypto.randomUUID(),
        name: clean,
        settings,
        created: new Date().toISOString(),
      };
      commit(existing ? presets.map((p) => (p.id === existing.id ? preset : p)) : [...presets, preset]);
    },
    [presets, commit],
  );

  const remove = useCallback(
    (id: string) => commit(presets.filter((p) => p.id !== id)),
    [presets, commit],
  );

  const exportFile = useCallback(() => {
    const doc = { format: FILE_FORMAT, version: 1, presets };
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'guitar-study-mate-presets.json';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [presets]);

  /** Merge presets from a file; same name replaces. Returns how many were read, or an error. */
  const importFile = useCallback(
    async (file: File): Promise<number | string> => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        return 'Dit bestand is geen geldig JSON-bestand.';
      }
      const list = Array.isArray(parsed)
        ? parsed
        : (parsed as { format?: string; presets?: unknown })?.format === FILE_FORMAT
          ? (parsed as { presets: unknown }).presets
          : null;
      const incoming = sanitize(list);
      if (incoming.length === 0) return 'In dit bestand staan geen presets van Guitar Study Mate.';
      const byName = new Map(presets.map((p) => [p.name.toLowerCase(), p]));
      for (const p of incoming) byName.set(p.name.toLowerCase(), p);
      commit([...byName.values()]);
      return incoming.length;
    },
    [presets, commit],
  );

  return { presets, saved, save, remove, exportFile, importFile };
}
