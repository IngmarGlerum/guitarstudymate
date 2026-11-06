import { MAX_FRET, TUNING, type Formula } from './theory';

export interface FretNote {
  midi: number;
  /** 0 = low E … 5 = high E */
  string: number;
  fret: number;
  /** scale degree, 1-based (1 = root) */
  degree: number;
  /** the index finger slides into this note (four notes per string) */
  slide?: boolean;
}

export interface Fingering {
  notes: FretNote[];
  /** degree the position starts on (1-based) */
  startDegree: number;
}

/** Normal stretch on one string; with four notes per string a slide is allowed instead. */
export const MAX_SPAN = 5;

/** Ascending scale/chord tones from `startDegree`, as MIDI numbers, starting in fret range 0–11 on low E. */
function* tonesFrom(formula: Formula, rootPc: number, startDegree: number) {
  const iv = formula.intervals;
  const n = iv.length;
  const firstPc = (rootPc + iv[startDegree - 1]) % 12;
  const firstFret = (firstPc - (TUNING[0] % 12) + 12) % 12;
  const base = TUNING[0] + firstFret - iv[startDegree - 1]; // midi of the root just below/at the first note
  for (let k = startDegree - 1; ; k++) {
    const octave = Math.floor(k / n);
    yield { midi: base + 12 * octave + iv[k % n], degree: (k % n) + 1 };
  }
}

/**
 * Scale fingering with a fixed number of notes per string: take the scale in
 * order, `perString` notes on each string from low E to high E. The hand may
 * shift between strings; within a string the span is checked by `fits`.
 */
export function scaleFingering(
  formula: Formula,
  rootPc: number,
  startDegree: number,
  perString: number,
): Fingering | null {
  const notes: FretNote[] = [];
  const tones = tonesFrom(formula, rootPc, startDegree);
  for (let s = 0; s < TUNING.length; s++) {
    const onString: FretNote[] = [];
    for (let i = 0; i < perString; i++) {
      const t = tones.next().value!;
      const fret = t.midi - TUNING[s];
      if (fret < 0 || fret > MAX_FRET) return null;
      onString.push({ midi: t.midi, string: s, fret, degree: t.degree });
    }
    const span = onString[onString.length - 1].fret - onString[0].fret;
    if (perString < 4 && span > MAX_SPAN) return null;
    if (perString >= 4 && span > MAX_SPAN - 1) {
      // index finger slides from the first to the second note on this string
      onString[1].slide = true;
    }
    notes.push(...onString);
  }
  return { notes, startDegree };
}

/**
 * Arpeggio fingering: chord tones in order. Each tone goes to the next string when
 * it fits there inside the position (that gives the familiar one-or-two-per-string
 * shapes), otherwise it stays on the current string within the stretch. Ends when
 * a tone no longer fits anywhere above.
 */
export function arpeggioFingering(
  formula: Formula,
  rootPc: number,
  startDegree: number,
): Fingering | null {
  const notes: FretNote[] = [];
  const tones = tonesFrom(formula, rootPc, startDegree);
  let s = 0;
  let firstOnString = -1;
  let anchor = -1; // fret of the first note: the position

  const fits = (str: number, fret: number) => {
    if (fret < 0 || fret > MAX_FRET) return false;
    if (anchor >= 0 && (fret < anchor - 1 || fret > anchor + MAX_SPAN)) return false;
    if (str === s && firstOnString >= 0 && fret - firstOnString > MAX_SPAN - 1) return false;
    return true;
  };
  const place = (str: number, midi: number, degree: number) => {
    const fret = midi - TUNING[str];
    if (str !== s) firstOnString = -1;
    s = str;
    if (anchor < 0) anchor = fret;
    if (firstOnString < 0) firstOnString = fret;
    notes.push({ midi, string: str, fret, degree });
  };

  for (;;) {
    const t = tones.next().value!;
    const candidates =
      notes.length === 0 ? [0] : [s + 1, s, ...Array.from({ length: 4 }, (_, i) => s + 2 + i)];
    const str = candidates.find(
      (c) => c < TUNING.length && fits(c, t.midi - TUNING[c]),
    );
    if (str === undefined) break;
    place(str, t.midi, t.degree);
  }
  return notes.length > 1 ? { notes, startDegree } : null;
}

/** relative shape, to recognise positions that repeat in symmetric scales */
const shapeKey = (f: Fingering) =>
  f.notes.map((n) => `${n.string}:${n.fret - f.notes[0].fret}`).join(',');

export interface PositionOption {
  startDegree: number;
  fingering: Fingering;
}

/** All distinct positions: one per starting degree, minus repeats of the same shape. */
export function positions(
  kind: 'scale' | 'arpeggio',
  formula: Formula,
  rootPc: number,
  perString: number,
): PositionOption[] {
  const seen = new Set<string>();
  const out: PositionOption[] = [];
  for (let d = 1; d <= formula.intervals.length; d++) {
    const f =
      kind === 'scale'
        ? scaleFingering(formula, rootPc, d, perString)
        : arpeggioFingering(formula, rootPc, d);
    if (!f) continue;
    const key = shapeKey(f);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ startDegree: d, fingering: f });
  }
  return out;
}

/** Notes-per-string choices that give at least one playable position for this scale. */
export function perStringOptions(formula: Formula, rootPc: number): number[] {
  return [2, 3, 4].filter((k) => positions('scale', formula, rootPc, k).length > 0);
}
