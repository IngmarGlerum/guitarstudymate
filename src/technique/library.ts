import { CHORD_TYPES, fits, type ChordTypeId } from './chords';

/**
 * The library (requirements B): scales, arpeggios and triads are one type, a list
 * of intervals with metadata. Generator, routes and learning paths read from here.
 */

export type EntryKind = 'scale' | 'arpeggio' | 'triad';
export type Family =
  | 'major'
  | 'melodic-minor'
  | 'harmonic-minor'
  | 'pentatonic'
  | 'symmetric'
  | 'chord';

export interface LibraryEntry {
  id: string;
  label: string;
  kind: EntryKind;
  family: Family;
  /** mode number within its parent scale (1 = the parent itself) */
  mode?: number;
  /** semitones above the root, ascending, within one octave */
  intervals: readonly number[];
  /** degree names, e.g. "1", "♭3", "♯4" */
  degrees: readonly string[];
  /** brightness: mean interval size; for the major modes this orders lydian … locrian (B-5) */
  brightness: number;
  /** what makes it sound like itself (B-6) */
  characterDegrees: readonly string[];
  /** tension notes it contains, named against its typical chord (B-2) */
  tensions: readonly string[];
  /** number of tension notes, with hand corrections (B-3) */
  tensionScore: number;
  /** chord types it fits by guide tones and alterations (B-4) */
  chordTypes: readonly ChordTypeId[];
  /** the chord it is usually played over, used for the default vamp */
  homeChord: ChordTypeId;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MELODIC = [0, 2, 3, 5, 7, 9, 11];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];

/** the n-th mode (0-based) of a seven-note scale */
const rotate = (scale: readonly number[], n: number) =>
  scale.map((_, i) => (scale[(i + n) % scale.length] - scale[n] + 12) % 12).sort((a, b) => a - b);

const DEFAULT_NAMES = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];

/** Degree names: by position for seven-note scales (so ♯4 stays a fourth), else by semitone. */
function degreeNames(iv: readonly number[]): string[] {
  if (iv.length !== 7) return iv.map((x) => DEFAULT_NAMES[x]);
  return iv.map((x, i) => {
    const d = x - MAJOR[i];
    const acc = d === -2 ? '♭♭' : d === -1 ? '♭' : d === 1 ? '♯' : d === 2 ? '♯♯' : '';
    return `${acc}${i + 1}`;
  });
}

/** ♭9, ♯9, ♯11, ♭13 as heard over the scale's own root (B-2, B-3). */
function tensionsOf(iv: readonly number[]): string[] {
  const has = (x: number) => iv.includes(x);
  const out: string[] = [];
  if (has(1)) out.push('♭9');
  if (has(3) && has(4)) out.push('♯9');
  if (has(6) && has(7)) out.push('♯11');
  if (has(8) && (has(7) || has(4))) out.push('♭13');
  return out;
}

const MAJOR_MODE_NAMES = ['Ionisch (majeur)', 'Dorisch', 'Frygisch', 'Lydisch', 'Mixolydisch', 'Aeolisch (mineur)', 'Locrisch'];
const MAJOR_MODE_IDS = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'];
const MAJOR_CHARACTER = [['7'], ['6'], ['♭2'], ['♯4'], ['♭7'], ['♭6'], ['♭5']];
const MAJOR_HOME: ChordTypeId[] = ['maj7', 'm7', 'm7', 'maj7#11', '7', 'm7', 'm7b5'];

const MELODIC_NAMES = ['Melodisch mineur', 'Dorisch ♭2', 'Lydisch overmatig', 'Lydisch dominant', 'Mixolydisch ♭6', 'Locrisch ♮2', 'Gealtereerd (superlocrisch)'];
const MELODIC_IDS = ['melodic-minor', 'dorian-b2', 'lydian-augmented', 'lydian-dominant', 'mixolydian-b6', 'locrian-nat2', 'altered'];
const MELODIC_HOME: ChordTypeId[] = ['mMaj7', 'm7', 'maj7#11', '7#11', '7', 'm7b5', '7alt'];

const HARMONIC_NAMES = ['Harmonisch mineur', 'Locrisch ♮6', 'Ionisch ♯5', 'Dorisch ♯4', 'Frygisch dominant', 'Lydisch ♯2', 'Ultralocrisch'];
const HARMONIC_IDS = ['harmonic-minor', 'locrian-nat6', 'ionian-sharp5', 'dorian-sharp4', 'phrygian-dominant', 'lydian-sharp2', 'ultralocrian'];
const HARMONIC_HOME: ChordTypeId[] = ['mMaj7', 'm7b5', 'maj7', 'm7', '7b9', 'maj7', 'dim7'];

/**
 * Conventional degree names where position-based naming misleads: these scales
 * are heard over a dominant, so ♭3 is really ♯9 and ♭4 is the major third.
 */
const DEGREE_OVERRIDE: Record<string, readonly string[]> = {
  altered: ['1', '♭9', '♯9', '3', '♯11', '♭13', '♭7'],
  ultralocrian: ['1', '♭2', '♭3', '♭4', '♭5', '♭6', '♭♭7'],
  'octatonic-hw': ['1', '♭9', '♯9', '3', '♯11', '5', '13', '♭7'],
  'octatonic-wh': ['1', '2', '♭3', '4', '♭5', '♭6', '♭♭7', '7'],
  'whole-tone': ['1', '2', '3', '♯4', '♯5', '♭7'],
};

/** Chord types set by hand where the guide-tone rule over-reaches. */
const CHORD_OVERRIDE: Record<string, readonly ChordTypeId[]> = {
  ultralocrian: ['dim7'],
};

/** Hand corrections to the derived tension score (B-3). */
const TENSION_OVERRIDE: Record<string, number> = {
  // ♭6 in natural minor colours the chord but is no tension on a minor seventh chord
  aeolian: 0,
  // the whole-tone scale is "all tension" on a dominant, but has only ♯11/♭13 by the rule
  'whole-tone': 2,
};

type Raw = Omit<LibraryEntry, 'degrees' | 'brightness' | 'tensions' | 'tensionScore' | 'chordTypes' | 'characterDegrees'> & {
  characterDegrees?: readonly string[];
};

function complete(raw: Raw, majorModes: readonly (readonly number[])[]): LibraryEntry {
  const iv = raw.intervals;
  const degrees = DEGREE_OVERRIDE[raw.id] ?? degreeNames(iv);
  const tensions = raw.kind === 'scale' ? tensionsOf(iv) : [];
  let character = raw.characterDegrees;
  if (!character && iv.length === 7) {
    // degrees that differ from the closest major mode with the same third
    let best: string[] = [];
    let fewest = Infinity;
    const sameThird = majorModes.filter((m) => m[2] === iv[2]);
    for (const m of sameThird.length ? sameThird : majorModes) {
      const diff = degrees.filter((_, i) => iv[i] !== m[i]);
      if (diff.length > 0 && diff.length < fewest) {
        fewest = diff.length;
        best = diff;
      }
    }
    character = best;
  }
  return {
    ...raw,
    degrees,
    brightness: Math.round((iv.reduce((a, b) => a + b, 0) / iv.length) * 100) / 100,
    characterDegrees: character ?? [],
    tensions,
    tensionScore: TENSION_OVERRIDE[raw.id] ?? tensions.length,
    chordTypes:
      CHORD_OVERRIDE[raw.id] ?? CHORD_TYPES.filter((c) => fitsAsChordScale(iv, c)).map((c) => c.id),
  };
}

/**
 * A scale with both a minor and a major third is a dominant colour: the minor one
 * is a ♯9, so it does not count as the third of a minor chord.
 */
function fitsAsChordScale(iv: readonly number[], c: (typeof CHORD_TYPES)[number]) {
  if (!fits(iv, c)) return false;
  const minorChord = c.guide.includes(3);
  return !(minorChord && iv.includes(3) && iv.includes(4));
}

function build(): LibraryEntry[] {
  const majorModes = MAJOR_MODE_IDS.map((_, n) => rotate(MAJOR, n));
  const raws: Raw[] = [];
  MAJOR_MODE_IDS.forEach((id, n) =>
    raws.push({
      id,
      label: MAJOR_MODE_NAMES[n],
      kind: 'scale',
      family: 'major',
      mode: n + 1,
      intervals: rotate(MAJOR, n),
      characterDegrees: MAJOR_CHARACTER[n],
      homeChord: MAJOR_HOME[n],
    }),
  );
  MELODIC_IDS.forEach((id, n) =>
    raws.push({
      id,
      label: MELODIC_NAMES[n],
      kind: 'scale',
      family: 'melodic-minor',
      mode: n + 1,
      intervals: rotate(MELODIC, n),
      homeChord: MELODIC_HOME[n],
    }),
  );
  HARMONIC_IDS.forEach((id, n) =>
    raws.push({
      id,
      label: HARMONIC_NAMES[n],
      kind: 'scale',
      family: 'harmonic-minor',
      mode: n + 1,
      intervals: rotate(HARMONIC, n),
      homeChord: HARMONIC_HOME[n],
    }),
  );
  raws.push(
    { id: 'penta-major', label: 'Pentatonisch majeur', kind: 'scale', family: 'pentatonic', intervals: [0, 2, 4, 7, 9], characterDegrees: ['6'], homeChord: '6' },
    { id: 'penta-minor', label: 'Pentatonisch mineur', kind: 'scale', family: 'pentatonic', intervals: [0, 3, 5, 7, 10], characterDegrees: ['♭3', '♭7'], homeChord: 'm7' },
    { id: 'octatonic-hw', label: 'Octatonisch (half–heel)', kind: 'scale', family: 'symmetric', intervals: [0, 1, 3, 4, 6, 7, 9, 10], characterDegrees: ['♭9', '♯9', '♯11'], homeChord: '7b9' },
    { id: 'octatonic-wh', label: 'Octatonisch (heel–half)', kind: 'scale', family: 'symmetric', intervals: [0, 2, 3, 5, 6, 8, 9, 11], characterDegrees: ['♭5', '♭6'], homeChord: 'dim7' },
    { id: 'whole-tone', label: 'Heletoons', kind: 'scale', family: 'symmetric', intervals: [0, 2, 4, 6, 8, 10], characterDegrees: ['♯4', '♯5'], homeChord: '7#5' },
  );
  // triads and arpeggios: chord tones as pitch classes within the octave
  const chord = (id: string, label: string, kind: EntryKind, intervals: number[], homeChord: ChordTypeId) =>
    raws.push({ id, label, kind, family: 'chord', intervals, characterDegrees: [], homeChord });
  chord('maj', 'Majeur', 'triad', [0, 4, 7], 'maj7');
  chord('min', 'Mineur', 'triad', [0, 3, 7], 'm7');
  chord('dim', 'Verminderd', 'triad', [0, 3, 6], 'm7b5');
  chord('aug', 'Overmatig', 'triad', [0, 4, 8], '7#5');
  chord('maj7', 'Majeur 7', 'arpeggio', [0, 4, 7, 11], 'maj7');
  chord('dom7', 'Dominant 7', 'arpeggio', [0, 4, 7, 10], '7');
  chord('min7', 'Mineur 7', 'arpeggio', [0, 3, 7, 10], 'm7');
  chord('m7b5', 'Halfverminderd', 'arpeggio', [0, 3, 6, 10], 'm7b5');
  chord('dim7', 'Verminderd 7', 'arpeggio', [0, 3, 6, 9], 'dim7');
  chord('maj9', 'Majeur 7 met 9', 'arpeggio', [0, 2, 4, 7, 11], 'maj7');
  chord('dom9', 'Dominant 7 met 9', 'arpeggio', [0, 2, 4, 7, 10], '7');
  chord('min9', 'Mineur 7 met 9', 'arpeggio', [0, 2, 3, 7, 10], 'm7');
  chord('maj13', 'Majeur 7 met 9 en 13', 'arpeggio', [0, 2, 4, 7, 9, 11], 'maj7');
  chord('dom13', 'Dominant 7 met 9 en 13', 'arpeggio', [0, 2, 4, 7, 9, 10], '7');
  chord('min13', 'Mineur 7 met 9 en 13', 'arpeggio', [0, 2, 3, 7, 9, 10], 'm7');
  return raws.map((r) => complete(r, majorModes));
}

export const LIBRARY: readonly LibraryEntry[] = build();

export const libraryEntry = (id: string) => LIBRARY.find((e) => e.id === id);

export const FAMILY_LABEL: Record<Family, string> = {
  major: 'Modi van majeur',
  'melodic-minor': 'Modi van melodisch mineur',
  'harmonic-minor': 'Modi van harmonisch mineur',
  pentatonic: 'Pentatonisch',
  symmetric: 'Symmetrisch',
  chord: 'Akkoorden',
};
