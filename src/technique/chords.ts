/**
 * Chord types and chord symbols. A chord type is again a list of intervals, plus
 * what a scale must (and must not) contain to fit it (requirements B-4, R-5).
 */

export type ChordTypeId =
  | 'maj7'
  | '6'
  | 'maj7#11'
  | '7'
  | '7sus4'
  | '7b9'
  | '7#11'
  | '7#5'
  | '7alt'
  | 'm7'
  | 'm6'
  | 'mMaj7'
  | 'm7b5'
  | 'dim7';

export interface ChordType {
  id: ChordTypeId;
  /** how it is written after the root */
  symbol: string;
  /** chord tones above the root (may exceed 12 for tensions) */
  intervals: readonly number[];
  /** guide tones: the third and the seventh (or sixth); a fitting scale contains them */
  guide: readonly number[];
  /** extra pitch classes a scale must contain to fit, e.g. ♭9 for 7♭9 */
  requires?: readonly (number | readonly number[])[];
  /** pitch classes a fitting scale must not contain, e.g. the natural 9 on 7♭9 */
  forbids?: readonly number[];
}

export const CHORD_TYPES: readonly ChordType[] = [
  { id: 'maj7', symbol: 'maj7', intervals: [0, 4, 7, 11], guide: [4, 11] },
  { id: '6', symbol: '6', intervals: [0, 4, 7, 9], guide: [4, 9] },
  { id: 'maj7#11', symbol: 'maj7♯11', intervals: [0, 4, 7, 11, 18], guide: [4, 11], requires: [6] },
  { id: '7', symbol: '7', intervals: [0, 4, 7, 10], guide: [4, 10] },
  { id: '7sus4', symbol: '7sus4', intervals: [0, 5, 7, 10], guide: [5, 10] },
  { id: '7b9', symbol: '7♭9', intervals: [0, 4, 7, 10, 13], guide: [4, 10], requires: [1], forbids: [2] },
  { id: '7#11', symbol: '7♯11', intervals: [0, 4, 7, 10, 18], guide: [4, 10], requires: [6], forbids: [5] },
  { id: '7#5', symbol: '7♯5', intervals: [0, 4, 8, 10], guide: [4, 10], requires: [8], forbids: [7] },
  {
    id: '7alt',
    symbol: '7alt',
    intervals: [0, 4, 10, 13, 20],
    guide: [4, 10],
    requires: [[1, 3], 8],
    forbids: [2, 7],
  },
  { id: 'm7', symbol: 'm7', intervals: [0, 3, 7, 10], guide: [3, 10] },
  { id: 'm6', symbol: 'm6', intervals: [0, 3, 7, 9], guide: [3, 9] },
  { id: 'mMaj7', symbol: 'm(maj7)', intervals: [0, 3, 7, 11], guide: [3, 11] },
  { id: 'm7b5', symbol: 'm7♭5', intervals: [0, 3, 6, 10], guide: [3, 10], requires: [6], forbids: [7] },
  { id: 'dim7', symbol: 'dim7', intervals: [0, 3, 6, 9], guide: [3, 9], requires: [6], forbids: [7] },
];

export const chordType = (id: ChordTypeId) => CHORD_TYPES.find((c) => c.id === id)!;

export interface Chord {
  rootPc: number;
  type: ChordTypeId;
  /** optional bass note (slash chord) */
  bassPc?: number;
}

/** Does a scale (pitch classes above its own root, shifted by `offset`) fit this chord type? */
export function fits(scalePcs: readonly number[], type: ChordType, offset = 0): boolean {
  const set = new Set(scalePcs.map((p) => (((p + offset) % 12) + 12) % 12));
  if (!type.guide.every((g) => set.has(g % 12))) return false;
  for (const r of type.requires ?? []) {
    const any = Array.isArray(r) ? r : [r];
    if (!any.some((x) => set.has(x % 12))) return false;
  }
  return !(type.forbids ?? []).some((f) => set.has(f % 12));
}

/** Why a scale is an unusual choice on a chord (R-5), or null when it fits. */
export function fitWarning(scalePcs: readonly number[], type: ChordType, offset = 0): string | null {
  const set = new Set(scalePcs.map((p) => (((p + offset) % 12) + 12) % 12));
  const missing = type.guide.filter((g) => !set.has(g % 12));
  if (missing.length) return 'Deze ladder mist de terts of de septiem van het akkoord.';
  if ((type.forbids ?? []).some((f) => set.has(f % 12))) {
    return type.id === '7b9'
      ? 'Deze ladder heeft een natuurlijke 9 op een ♭9-akkoord.'
      : 'Deze ladder botst met een alteratie van het akkoord.';
  }
  return null;
}

// ---- chord symbols ("Dm7 | G7 | Cmaj7") ----

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Quality spellings, longest first so "maj7#11" wins over "maj7". */
const QUALITIES: [RegExp, ChordTypeId][] = [
  [/^(maj7|ma7|Δ7?|\^7?|M7)(#|♯)11$/, 'maj7#11'],
  [/^(m|min|-)(\(?(maj|ma|Δ|\^|M)7\)?)$/, 'mMaj7'],
  [/^(m7b5|m7♭5|min7b5|-7b5|ø7?|h7?)$/, 'm7b5'],
  [/^(dim7|°7|o7)$/, 'dim7'],
  [/^(maj7|ma7|Δ7?|\^7?|M7|maj9|\^9|Δ9)$/, 'maj7'],
  [/^(6|69|6\/9)$/, '6'],
  [/^(m6|min6|-6|m69|-69)$/, 'm6'],
  [/^(m7|min7|-7|m9|-9|m11|-11|m)$/, 'm7'],
  [/^(-|min)$/, 'm7'],
  [/^(7alt|alt|7#9b13|7♯9♭13)$/, '7alt'],
  [/^(7b9|7♭9|7b9b13|7♭9♭13|7b9#9)$/, '7b9'],
  [/^(7#11|7♯11|9#11|13#11|7b5|7♭5)$/, '7#11'],
  [/^(7#5|7♯5|7\+|\+7|aug7|9#5)$/, '7#5'],
  [/^(7sus4?|9sus4?|13sus4?|sus4?|sus)$/, '7sus4'],
  [/^(7|9|13|11)$/, '7'],
  [/^$/, 'maj7'],
];

/** Parse one chord symbol such as "Dm7", "B♭7alt", "C^7", "F#ø", "G7/B". */
export function parseChord(text: string): Chord | null {
  const t = text.trim();
  const m = t.match(/^([A-G])([#♯b♭]?)(.*?)(?:\/([A-G])([#♯b♭]?))?$/);
  if (!m) return null;
  const acc = (s: string) => (s === '#' || s === '♯' ? 1 : s === 'b' || s === '♭' ? -1 : 0);
  const rootPc = (LETTER[m[1]] + acc(m[2]) + 12) % 12;
  const quality = m[3].replace(/\s+/g, '');
  const hit = QUALITIES.find(([re]) => re.test(quality));
  if (!hit) return null;
  const chord: Chord = { rootPc, type: hit[1] };
  if (m[4]) chord.bassPc = (LETTER[m[4]] + acc(m[5]) + 12) % 12;
  return chord;
}

/** Parse "Dm7 | G7 | Cmaj7" or "Dm7 G7": one chord per bar. Returns chords and unreadable parts. */
export function parseChordLine(text: string): { chords: Chord[]; unknown: string[] } {
  const parts = text
    .split(/[|\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chords: Chord[] = [];
  const unknown: string[] = [];
  for (const p of parts) {
    const c = parseChord(p);
    if (c) chords.push(c);
    else unknown.push(p);
  }
  return { chords, unknown };
}

const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

export function chordName(c: Chord, flats = false) {
  const names = flats ? FLAT : SHARP;
  const t = chordType(c.type);
  const base = `${names[c.rootPc]}${t.symbol}`;
  return c.bassPc !== undefined ? `${base}/${names[c.bassPc]}` : base;
}
