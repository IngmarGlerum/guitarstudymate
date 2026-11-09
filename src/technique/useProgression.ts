import { useCallback, useMemo } from 'react';
import type { ExerciseSettings } from './exercise';
import type { Key } from './harmony';
import { buildProgressionPass, choicesForPass, planProgression, type ProgressionPass } from './progressionExercise';
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

  const passFor = useCallback(
    (pass: number): ProgressionPass & { routeIds: Map<string, string> } => {
      const { choices, routeIds } = choicesForPass(plan, s.routeLayer, s.routeOff, s.routeOrder, pass);
      const built = buildProgressionPass(segs, choices, {
        subdivision: s.subdivision,
        content: s.content,
        targetMode: s.targetMode,
        windowLo: s.windowLo,
        follow: s.followPosition,
        direction: s.direction,
      });
      return { ...built, routeIds };
    },
    [plan, segs, s.routeLayer, s.routeOff, s.routeOrder, s.subdivision, s.content, s.targetMode, s.windowLo, s.followPosition, s.direction],
  );

  return { parsed, totalBars, from, to, segs, plan, autoKey, passFor };
}

export type ProgressionState = ReturnType<typeof useProgression>;
