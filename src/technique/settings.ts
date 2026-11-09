import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  formulaFor,
  SUBDIVISIONS,
  type ExerciseSettings,
} from './exercise';
import { enclosureById } from './enclosures';
import { perStringOptions, positions } from './fingering';
import { ARPEGGIOS, ROOTS, SCALES } from './theory';

const STORAGE_KEY = 'gsm.technique.settings';
export const BPM_MIN = 30;
export const BPM_MAX = 300;

/** Fill gaps and fix impossible combinations (e.g. a position the new scale lacks). */
export function normalize(raw: Partial<ExerciseSettings>): ExerciseSettings {
  const s: ExerciseSettings = { ...DEFAULT_SETTINGS, ...raw };
  if (!['scale', 'arpeggio', 'pattern', 'progression'].includes(s.kind)) s.kind = 'scale';
  if (typeof s.progressionText !== 'string') s.progressionText = DEFAULT_SETTINGS.progressionText;
  if (typeof s.progressionId !== 'string') s.progressionId = DEFAULT_SETTINGS.progressionId;
  if (typeof s.keyChoice !== 'string' || !/^(auto|\d{1,2}:(maj|min))$/.test(s.keyChoice)) s.keyChoice = 'auto';
  s.barFrom = Math.max(1, Math.round(Number(s.barFrom) || 1));
  s.barTo = Math.max(0, Math.round(Number(s.barTo) || 0));
  if (s.barTo && s.barTo < s.barFrom) s.barTo = s.barFrom;
  if (s.content !== 'scale' && s.content !== 'enclosures') s.content = 'targets';
  if (!Array.isArray(s.enclosureIds)) s.enclosureIds = DEFAULT_SETTINGS.enclosureIds;
  s.enclosureIds = [...new Set(s.enclosureIds.filter((id) => typeof id === 'string' && enclosureById(id)))];
  if (s.enclosureOrder !== 'random') s.enclosureOrder = 'sequence';
  if (!['onBeat', 'anticipation', 'suspension'].includes(s.enclosureRhythm)) s.enclosureRhythm = 'onBeat';
  if (!['rest', 'scale', 'arpeggio', 'pattern'].includes(s.fill)) s.fill = 'rest';
  if (!['ask', 'sixteenths', 'triplets', 'shorter'].includes(s.fitMode)) s.fitMode = 'ask';
  if (s.targetMode !== 'all') s.targetMode = 'guide';
  s.windowLo = Math.max(0, Math.min(17, Math.round(Number(s.windowLo) || 0)));
  s.followPosition = s.followPosition !== false;
  if (!['inKey', 'common', 'adventurous'].includes(s.routeLayer)) s.routeLayer = 'common';
  if (s.routeOrder !== 'random') s.routeOrder = 'sequence';
  if (typeof s.routeOff !== 'object' || s.routeOff === null || Array.isArray(s.routeOff)) s.routeOff = {};
  if (!SCALES.some((x) => x.id === s.scaleId)) s.scaleId = DEFAULT_SETTINGS.scaleId;
  if (!ARPEGGIOS.some((x) => x.id === s.arpeggioId)) s.arpeggioId = DEFAULT_SETTINGS.arpeggioId;
  if (!ROOTS.some((r) => r.pc === s.rootPc)) s.rootPc = 0;
  if (!SUBDIVISIONS.some((d) => d.value === s.subdivision)) s.subdivision = 2;
  if (!['up', 'down', 'updown'].includes(s.direction)) s.direction = 'updown';
  s.bpm = Math.round(Math.min(BPM_MAX, Math.max(BPM_MIN, Number(s.bpm) || 80)));
  s.repeats = Math.max(0, Math.min(99, Math.round(Number(s.repeats) || 0)));
  if (!Array.isArray(s.pattern) || s.pattern.length === 0) s.pattern = DEFAULT_SETTINGS.pattern;

  const formula = formulaFor(s);
  if (s.kind !== 'arpeggio') {
    const options = perStringOptions(formula, s.rootPc);
    if (!options.includes(s.perString)) s.perString = options.includes(3) ? 3 : (options[0] ?? 3);
  }
  const kind = s.kind === 'arpeggio' ? 'arpeggio' : 'scale';
  const pos = positions(kind, formula, s.rootPc, s.perString);
  if (!pos.some((p) => p.startDegree === s.position)) s.position = pos[0]?.startDegree ?? 1;
  return s;
}

function load(): ExerciseSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalize(raw ? (JSON.parse(raw) as Partial<ExerciseSettings>) : {});
  } catch {
    return normalize({});
  }
}

/** Exercise settings, remembered per browser so the mode reopens where it was left. */
export function useExerciseSettings() {
  const [settings, setState] = useState<ExerciseSettings>(load);
  const update = useCallback((patch: Partial<ExerciseSettings>) => {
    setState((prev) => {
      const next = normalize({ ...prev, ...patch });
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable: keep it for this visit
      }
      return next;
    });
  }, []);
  const replace = useCallback((all: Partial<ExerciseSettings>) => update(all), [update]);

  const formula = formulaFor(settings);
  const perString = useMemo(
    () => (settings.kind === 'arpeggio' ? [] : perStringOptions(formula, settings.rootPc)),
    [formula, settings.kind, settings.rootPc],
  );
  const positionOptions = useMemo(
    () =>
      positions(
        settings.kind === 'arpeggio' ? 'arpeggio' : 'scale',
        formula,
        settings.rootPc,
        settings.perString,
      ),
    [formula, settings.kind, settings.rootPc, settings.perString],
  );
  return { settings, update, replace, perStringOptions: perString, positionOptions };
}
