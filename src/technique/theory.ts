import { LIBRARY } from './library';

/**
 * Music theory for the technique trainer. Scales and arpeggios are interval
 * lists (semitones above the root), so new ones are one line each.
 */

export interface Formula {
  id: string;
  label: string;
  /** semitones above the root, ascending, within one octave */
  intervals: readonly number[];
}

/** Scales offered in the exercise, from the library (B: one source). */
export const SCALES: readonly Formula[] = LIBRARY.filter((e) => e.kind === 'scale');

/**
 * Triads and arpeggios as pitch classes, ascending within the octave. Added 9ths
 * and 13ths therefore sound as 2 and 6 above the root (1 9 3 5 7, 1 9 3 5 13 7).
 */
export const ARPEGGIOS: readonly Formula[] = LIBRARY.filter((e) => e.kind !== 'scale');

/** Roots as pitch classes (0 = C) with a spelling preference for accidentals. */
export const ROOTS: readonly { pc: number; label: string; flats: boolean }[] = [
  { pc: 0, label: 'C', flats: false },
  { pc: 1, label: 'C♯ / D♭', flats: true },
  { pc: 2, label: 'D', flats: false },
  { pc: 3, label: 'E♭', flats: true },
  { pc: 4, label: 'E', flats: false },
  { pc: 5, label: 'F', flats: true },
  { pc: 6, label: 'F♯', flats: false },
  { pc: 7, label: 'G', flats: false },
  { pc: 8, label: 'A♭', flats: true },
  { pc: 9, label: 'A', flats: false },
  { pc: 10, label: 'B♭', flats: true },
  { pc: 11, label: 'B', flats: false },
];

const SHARPS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

export function pcName(pc: number, flats: boolean) {
  return (flats ? FLATS : SHARPS)[((pc % 12) + 12) % 12];
}

/** Standard tuning, low E to high E. */
export const TUNING = [40, 45, 50, 55, 59, 64] as const;
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'] as const;
export const MAX_FRET = 22;
