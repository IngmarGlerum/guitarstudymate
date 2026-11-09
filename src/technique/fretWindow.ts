import { chordType, type Chord } from './chords';
import type { FretNote } from './fingering';
import { libraryEntry } from './library';
import { MAX_FRET, TUNING } from './theory';

/**
 * Positions for progressions: a fret window instead of a full run. Each chord
 * looks up its route's notes inside the window, so helper notes (V-1) and
 * following the hand between chords (V-2, R-8) come from the same idea.
 */

export const WINDOW_SPAN = 4; // frets lo … lo+4: one finger per fret plus a stretch

export interface ScaleChoice {
  scaleId: string;
  offset: number;
}

export function scalePcs(choice: ScaleChoice, chord: Chord) {
  const e = libraryEntry(choice.scaleId);
  const root = (chord.rootPc + choice.offset) % 12;
  return { root, pcs: new Set((e?.intervals ?? []).map((i) => (i + root) % 12)), intervals: e?.intervals ?? [] };
}

/** Every note of the scale inside frets lo…lo+span, low to high, one place per pitch. */
export function boxNotes(choice: ScaleChoice, chord: Chord, lo: number, span = WINDOW_SPAN): FretNote[] {
  const { root, pcs, intervals } = scalePcs(choice, chord);
  const byMidi = new Map<number, FretNote>();
  for (let s = 0; s < TUNING.length; s++) {
    for (let f = Math.max(0, lo); f <= Math.min(MAX_FRET, lo + span); f++) {
      const midi = TUNING[s] + f;
      if (!pcs.has(midi % 12)) continue;
      if (byMidi.has(midi)) continue; // the lower string keeps it: fewer string crossings
      const degree = intervals.indexOf((midi - root + 120) % 12) + 1;
      byMidi.set(midi, { midi, string: s, fret: f, degree });
    }
  }
  return [...byMidi.values()].sort((a, b) => a.midi - b.midi);
}

export type TargetMode = 'guide' | 'all';

/** Chord tones that count as targets: guide tones (3rd and 7th) or all chord tones (O-4). */
export function targetPcs(chord: Chord, mode: TargetMode) {
  const t = chordType(chord.type);
  const list = mode === 'guide' ? t.guide : t.intervals;
  return new Set(list.map((i) => (i + chord.rootPc) % 12));
}

/**
 * The target for a chord: the target tone in the box nearest to the previous note
 * (voice leading, e.g. the 7th of Dm7 to the 3rd of G7). Without a previous note,
 * the one nearest the middle of the box.
 */
export function pickTarget(box: FretNote[], targets: Set<number>, prevMidi: number | null): FretNote | null {
  const cands = box.filter((n) => targets.has(n.midi % 12));
  if (!cands.length) return null;
  const centre = prevMidi ?? box[Math.floor(box.length / 2)]?.midi ?? cands[0].midi;
  return cands.reduce((best, n) => (Math.abs(n.midi - centre) < Math.abs(best.midi - centre) ? n : best));
}

/**
 * Following the hand (R-8): the window for the next chord whose target lies
 * closest to the last note played, without jumping far up or down the neck.
 */
export function followWindow(
  choice: ScaleChoice,
  chord: Chord,
  targets: Set<number>,
  prevLo: number,
  prevMidi: number | null,
): number {
  let best = prevLo;
  let bestCost = Infinity;
  for (let lo = Math.max(0, prevLo - 3); lo <= Math.min(MAX_FRET - WINDOW_SPAN, prevLo + 3); lo++) {
    const box = boxNotes(choice, chord, lo);
    const t = pickTarget(box, targets, prevMidi);
    if (!t) continue;
    const cost = Math.abs(lo - prevLo) * 1.5 + (prevMidi === null ? 0 : Math.abs(t.midi - prevMidi));
    if (cost < bestCost) {
      bestCost = cost;
      best = lo;
    }
  }
  return best;
}
