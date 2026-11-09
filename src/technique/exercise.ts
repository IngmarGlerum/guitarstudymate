import { arpeggioFingering, scaleFingering, type FretNote } from './fingering';
import { ARPEGGIOS, SCALES, type Formula } from './theory';

export type ExerciseKind = 'scale' | 'arpeggio' | 'pattern' | 'progression';
export type Direction = 'up' | 'down' | 'updown';
/** notes per beat: quarters, eighths, triplets, sixteenths */
export type Subdivision = 1 | 2 | 3 | 4;

export const SUBDIVISIONS: { value: Subdivision; label: string }[] = [
  { value: 1, label: 'Kwarten' },
  { value: 2, label: 'Achtsten' },
  { value: 3, label: 'Triolen' },
  { value: 4, label: 'Zestienden' },
];

export interface ExerciseSettings {
  kind: ExerciseKind;
  scaleId: string;
  arpeggioId: string;
  rootPc: number;
  /** 1-based starting degree of the position */
  position: number;
  perString: number;
  subdivision: Subdivision;
  bpm: number;
  direction: Direction;
  /** 0 = endless */
  repeats: number;
  /** custom pattern as scale degrees, e.g. [1, 2, 3, 7] */
  pattern: number[];

  // ---- progressions (phase 2) ----
  /** a built-in form id, or 'custom' for the typed text */
  progressionId: string;
  progressionText: string;
  /** 'auto' or "<pc>:maj" / "<pc>:min" */
  keyChoice: string;
  /** bars to loop, 1-based and inclusive; 0 = to the end (P-8) */
  barFrom: number;
  barTo: number;
  /** only the target notes, or a scale run from each target */
  content: 'targets' | 'scale';
  targetMode: 'guide' | 'all';
  /** lowest fret of the window */
  windowLo: number;
  /** move the window with the hand between chords (R-8) */
  followPosition: boolean;
  /** route switch: up to which layer */
  routeLayer: 'inKey' | 'common' | 'adventurous';
  routeOrder: 'sequence' | 'random';
  /** routes unticked per unit (key: see unitKey) */
  routeOff: Record<string, string[]>;
}

export const DEFAULT_SETTINGS: ExerciseSettings = {
  kind: 'scale',
  scaleId: 'ionian',
  arpeggioId: 'maj7',
  rootPc: 0,
  position: 1,
  perString: 3,
  subdivision: 2,
  bpm: 80,
  direction: 'updown',
  repeats: 0,
  pattern: [1, 2, 3, 5],
  progressionId: 'ii-v-i-major',
  progressionText: 'Dm7 | G7 | Cmaj7 | Cmaj7',
  keyChoice: 'auto',
  barFrom: 1,
  barTo: 0,
  content: 'targets',
  targetMode: 'guide',
  windowLo: 5,
  followPosition: true,
  routeLayer: 'common',
  routeOrder: 'sequence',
  routeOff: {},
};

export const BEATS_PER_BAR = 4;

export function formulaFor(s: ExerciseSettings): Formula {
  return s.kind === 'arpeggio'
    ? (ARPEGGIOS.find((a) => a.id === s.arpeggioId) ?? ARPEGGIOS[0])
    : (SCALES.find((a) => a.id === s.scaleId) ?? SCALES[0]);
}

export function fingeringFor(s: ExerciseSettings) {
  const formula = formulaFor(s);
  return s.kind === 'arpeggio'
    ? arpeggioFingering(formula, s.rootPc, s.position)
    : scaleFingering(formula, s.rootPc, s.position, s.perString);
}

/**
 * Apply a custom pattern as a template that steps through the fingering: at step
 * i the pattern's degrees are taken relative to note i. Degrees above the scale
 * size continue into the next octave (8 = root again). A step that does not fit
 * completely inside the fingering is left out, so the run ends on the last step
 * that still fits.
 */
export function applyPattern(notes: FretNote[], pattern: number[]): FretNote[] {
  if (pattern.length === 0) return [];
  const offsets = pattern.map((d) => d - 1);
  const lo = Math.min(...offsets);
  const hi = Math.max(...offsets);
  const out: FretNote[] = [];
  for (let i = 0; i + lo >= 0 && i + hi < notes.length; i++) {
    for (const o of offsets) out.push(notes[i + o]);
  }
  return out;
}

/** One pass of the exercise in playing order (before repeats). */
export function buildPass(s: ExerciseSettings): FretNote[] {
  const fingering = fingeringFor(s);
  if (!fingering) return [];
  const up = s.kind === 'pattern' ? applyPattern(fingering.notes, s.pattern) : fingering.notes;
  if (s.direction === 'up') return up;
  const down = [...up].reverse();
  if (s.direction === 'down') return down;
  // up and back down without playing the top note twice
  return [...up, ...down.slice(1)];
}

/**
 * Notes of one repeat, padded with rests to whole bars so every repeat starts on
 * beat 1. A null slot is a rest. With up-and-down repeats, the bottom note that
 * would start the next pass again is dropped from the end of each pass instead.
 */
export function layoutPass(s: ExerciseSettings): (FretNote | null)[] {
  let pass = buildPass(s);
  if (s.direction === 'updown' && pass.length > 1) pass = pass.slice(0, -1);
  const perBar = BEATS_PER_BAR * s.subdivision;
  const bars = Math.max(1, Math.ceil(pass.length / perBar));
  const slots: (FretNote | null)[] = [...pass];
  while (slots.length < bars * perBar) slots.push(null);
  return slots;
}

/** Validate a typed pattern like "1, 2, 3, 7". Returns degrees or an error message. */
export function parsePattern(text: string): number[] | string {
  const parts = text
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return 'Vul minstens één getal in.';
  if (parts.length > 16) return 'Gebruik maximaal 16 getallen.';
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 15)) {
    return 'Gebruik hele getallen van 1 tot en met 15.';
  }
  return nums;
}
