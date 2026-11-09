import { useCallback, useMemo } from 'react';
import type { ExerciseSettings } from './exercise';
import type { Key } from './harmony';
import { enclosureById, type EnclosureForm } from './enclosures';
import {
  buildProgressionPass,
  choicesForPass,
  enclosureFits,
  planProgression,
  targetsOf,
  type PassOptions,
  type ProgressionPass,
} from './progressionExercise';
import { BUILTIN_PROGRESSIONS, parseProgression, segmentsOf, type Segment } from './progressions';

export function progressionText(s: ExerciseSettings) {
  return s.progressionId === 'custom'
    ? s.progressionText
    : (BUILTIN_PROGRESSIONS.find((p) => p.id === s.progressionId)?.text ?? BUILTIN_PROGRESSIONS[0].text);
}

export function parseKeyChoice(choice: string): Key | null {
  const m = choice.match(/^(\d{1,2}):(maj|min)$/);
  return m ? { pc: Number(m[1]) % 12, minor: m[2] === 'min' } : null;
}

/**
 * Everything a progression exercise needs, derived from the settings: the bars
 * in the selected range, key, units, routes, and the notes of any repeat. Screen
 * and sound both call `passFor`, so they always agree on the route of a repeat.
 */
export function useProgression(s: ExerciseSettings) {
  const text = progressionText(s);
  const parsed = useMemo(() => parseProgression(text), [text]);
  const totalBars = parsed.bars.length;
  const from = Math.min(Math.max(1, s.barFrom), Math.max(1, totalBars));
  const to = s.barTo ? Math.min(Math.max(s.barTo, from), totalBars) : totalBars;

  const segs = useMemo<Segment[]>(() => {
    const bars = parsed.bars.slice(from - 1, to);
    const texts = parsed.barTexts.slice(from - 1, to);
    return segmentsOf(bars, texts);
  }, [parsed, from, to]);

  const keyOverride = useMemo(() => parseKeyChoice(s.keyChoice), [s.keyChoice]);
  const plan = useMemo(() => planProgression(segs, keyOverride), [segs, keyOverride]);
  const autoKey = useMemo(() => planProgression(segs, null).key, [segs]);

  // enclosures: do the forms fit the harmonic rhythm? If not, play faster or shorter
  const enclosures = s.content === 'enclosures';
  const forms = useMemo(
    () => s.enclosureIds.map(enclosureById).filter((f): f is EnclosureForm => !!f),
    [s.enclosureIds],
  );
  const fitsAsIs = !enclosures || enclosureFits(segs, forms, s.subdivision);
  let subdivision = s.subdivision;
  if (!fitsAsIs && (s.fitMode === 'sixteenths' || s.fitMode === 'triplets')) {
    subdivision = Math.max(s.subdivision, s.fitMode === 'sixteenths' ? 4 : 3) as typeof s.subdivision;
  }
  /** shortened enclosures even after speeding up (or by choice) */
  const shortened = enclosures && !enclosureFits(segs, forms, subdivision);

  const passFor = useCallback(
    (pass: number): ProgressionPass & { routeIds: Map<string, string> } => {
      const o: PassOptions = {
        subdivision,
        content: s.content,
        targetMode: s.targetMode,
        windowLo: s.windowLo,
        follow: s.followPosition,
        direction: s.direction,
      };
      const { choices, routeIds } = choicesForPass(plan, s.routeLayer, s.routeOff, s.routeOrder, pass);
      if (enclosures) {
        const next = choicesForPass(plan, s.routeLayer, s.routeOff, s.routeOrder, pass + 1).choices;
        o.enclosure = {
          forms,
          order: s.enclosureOrder,
          rhythm: s.enclosureRhythm,
          fill: s.fill,
          pattern: s.pattern,
          pass,
          wrapTarget: targetsOf(segs, next, o).targets[0] ?? null,
        };
      }
      return { ...buildProgressionPass(segs, choices, o), routeIds };
    },
    [plan, segs, subdivision, enclosures, forms, s.routeLayer, s.routeOff, s.routeOrder, s.content, s.targetMode, s.windowLo, s.followPosition, s.direction, s.enclosureOrder, s.enclosureRhythm, s.fill, s.pattern],
  );

  return { parsed, totalBars, from, to, segs, plan, autoKey, passFor, subdivision, fitsAsIs, shortened, forms };
}

export type ProgressionState = ReturnType<typeof useProgression>;
