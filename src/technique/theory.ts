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

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
/** the n-th mode of the major scale */
const mode = (n: number) =>
  MAJOR.map((_, i) => (MAJOR[(i + n) % 7] - MAJOR[n] + 12) % 12).sort((a, b) => a - b);

export const SCALES: readonly Formula[] = [
  { id: 'ionian', label: 'Majeur (ionisch)', intervals: MAJOR },
  { id: 'dorian', label: 'Dorisch', intervals: mode(1) },
  { id: 'phrygian', label: 'Frygisch', intervals: mode(2) },
  { id: 'lydian', label: 'Lydisch', intervals: mode(3) },
  { id: 'mixolydian', label: 'Mixolydisch', intervals: mode(4) },
  { id: 'aeolian', label: 'Mineur (eolisch)', intervals: mode(5) },
  { id: 'locrian', label: 'Locrisch', intervals: mode(6) },
  { id: 'penta-major', label: 'Pentatonisch majeur', intervals: [0, 2, 4, 7, 9] },
  { id: 'penta-minor', label: 'Pentatonisch mineur', intervals: [0, 3, 5, 7, 10] },
  { id: 'harmonic-minor', label: 'Harmonisch mineur', intervals: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'melodic-minor', label: 'Melodisch mineur', intervals: [0, 2, 3, 5, 7, 9, 11] },
  { id: 'octatonic-hw', label: 'Octatonisch (half–heel)', intervals: [0, 1, 3, 4, 6, 7, 9, 10] },
  { id: 'octatonic-wh', label: 'Octatonisch (heel–half)', intervals: [0, 2, 3, 5, 6, 8, 9, 11] },
  { id: 'whole-tone', label: 'Heletoons', intervals: [0, 2, 4, 6, 8, 10] },
];

/**
 * Chord tones as pitch classes, ascending within the octave. Added 9ths and 13ths
 * therefore sound as 2 and 6 above the root (1 9 3 5 7, 1 9 3 5 13 7).
 */
export const ARPEGGIOS: readonly Formula[] = [
  { id: 'maj', label: 'Majeur', intervals: [0, 4, 7] },
  { id: 'min', label: 'Mineur', intervals: [0, 3, 7] },
  { id: 'dim', label: 'Verminderd', intervals: [0, 3, 6] },
  { id: 'aug', label: 'Overmatig', intervals: [0, 4, 8] },
  { id: 'maj7', label: 'Majeur 7', intervals: [0, 4, 7, 11] },
  { id: 'dom7', label: 'Dominant 7', intervals: [0, 4, 7, 10] },
  { id: 'min7', label: 'Mineur 7', intervals: [0, 3, 7, 10] },
  { id: 'm7b5', label: 'Halfverminderd', intervals: [0, 3, 6, 10] },
  { id: 'dim7', label: 'Verminderd 7', intervals: [0, 3, 6, 9] },
  { id: 'maj9', label: 'Majeur 7 met 9', intervals: [0, 2, 4, 7, 11] },
  { id: 'dom9', label: 'Dominant 7 met 9', intervals: [0, 2, 4, 7, 10] },
  { id: 'min9', label: 'Mineur 7 met 9', intervals: [0, 2, 3, 7, 10] },
  { id: 'maj13', label: 'Majeur 7 met 9 en 13', intervals: [0, 2, 4, 7, 9, 11] },
  { id: 'dom13', label: 'Dominant 7 met 9 en 13', intervals: [0, 2, 4, 7, 9, 10] },
  { id: 'min13', label: 'Mineur 7 met 9 en 13', intervals: [0, 2, 3, 7, 9, 10] },
];

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
