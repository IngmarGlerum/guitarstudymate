import { chordType, type Chord, type ChordTypeId } from '../chords';
import type { DrumSound } from './instruments';

/**
 * Style generators: for one bar of a chord (and a look at the next one) they
 * return what bass, piano and drums play. Times are in beats from the bar start.
 */

export type StyleId = 'swing' | 'bossa' | 'pop';

export const STYLES: { id: StyleId; label: string }[] = [
  { id: 'swing', label: 'Swing' },
  { id: 'bossa', label: 'Bossa nova' },
  { id: 'pop', label: 'Pop' },
];

export type AccompEvent =
  | { part: 'bass'; beat: number; dur: number; midi: number; vel: number }
  | { part: 'piano'; beat: number; dur: number; midis: number[]; vel: number }
  | { part: 'drums'; beat: number; sound: DrumSound; vel: number };

/** what each part played last, for walking lines and voice leading */
export interface StyleState {
  bass: number;
  voicing: number[];
}

export const newStyleState = (): StyleState => ({ bass: 40, voicing: [] });

const BEATS = 4;
const BASS_LO = 28; // E1
const BASS_HI = 50; // D3
const VOICING_LO = 50; // D3
const VOICING_HI = 76; // E5

/** Swing ratio: heavier at medium tempos, straighter when fast. */
export function swingRatio(bpm: number) {
  return Math.min(0.68, Math.max(0.55, 0.66 - (bpm - 120) * 0.0009));
}

/** pitch class of a chord tone given as semitones above the root */
const pc = (c: Chord, semis: number) => (c.rootPc + semis) % 12;

/** nearest MIDI note with pitch class p to `near`, kept inside [lo, hi] */
function nearest(p: number, near: number, lo: number, hi: number) {
  let best = lo + ((p - lo) % 12 + 12) % 12;
  for (let m = best; m <= hi; m += 12) if (Math.abs(m - near) < Math.abs(best - near)) best = m;
  return best;
}

// ---- piano voicings ----

/** Rootless voicings (semitones above the root): A form and B form. */
const ROOTLESS: Record<ChordTypeId, [number[], number[]]> = {
  maj7: [[4, 7, 11, 14], [11, 14, 16, 19]],
  '6': [[4, 7, 9, 14], [9, 14, 16, 19]],
  'maj7#11': [[4, 6, 11, 14], [11, 14, 16, 18]],
  '7': [[4, 9, 10, 14], [10, 14, 16, 21]],
  '7sus4': [[5, 7, 10, 14], [10, 14, 17, 19]],
  '7b9': [[4, 9, 10, 13], [10, 13, 16, 21]],
  '7#11': [[4, 6, 10, 14], [10, 14, 16, 18]],
  '7#5': [[4, 8, 10, 14], [10, 14, 16, 20]],
  '7alt': [[4, 8, 10, 15], [10, 15, 16, 20]],
  m7: [[3, 7, 10, 14], [10, 14, 15, 19]],
  m6: [[3, 7, 9, 14], [9, 14, 15, 19]],
  mMaj7: [[3, 7, 11, 14], [11, 14, 15, 19]],
  m7b5: [[3, 6, 10, 12], [10, 12, 15, 18]],
  dim7: [[3, 6, 9, 12], [9, 12, 15, 18]],
};

/** Place a voicing shape in range, as close as possible to the previous voicing. */
function placeVoicing(c: Chord, prev: number[]): number[] {
  const [a, b] = ROOTLESS[c.type];
  let best: number[] = [];
  let bestCost = Infinity;
  for (const shape of [a, b]) {
    for (let base = VOICING_LO - 12; base <= VOICING_HI; base++) {
      if (base % 12 !== c.rootPc) continue;
      const notes = shape.map((s) => base + s);
      if (notes[0] < VOICING_LO || notes[notes.length - 1] > VOICING_HI) continue;
      const centre = notes.reduce((x, y) => x + y, 0) / notes.length;
      const cost = prev.length
        ? notes.reduce((sum, n, i) => sum + Math.abs(n - (prev[i] ?? prev[prev.length - 1])), 0)
        : Math.abs(centre - 62) * 2;
      if (cost < bestCost) {
        bestCost = cost;
        best = notes;
      }
    }
  }
  return best;
}

/** Close-position chord with root on the bottom, for pop. */
function popVoicing(c: Chord, prev: number[]): number[] {
  const t = chordType(c.type).intervals.filter((x) => x < 12);
  const shapes = [t, [...t.slice(1), t[0] + 12], [...t.slice(2), t[0] + 12, t[1] + 12]];
  let best: number[] = [];
  let bestCost = Infinity;
  for (const shape of shapes) {
    for (let base = 48; base <= 64; base++) {
      if (base % 12 !== c.rootPc) continue;
      const notes = shape.map((s) => base + s);
      if (notes[0] < 52 || notes[notes.length - 1] > 76) continue;
      const cost = prev.length ? Math.abs(notes[0] - prev[0]) + Math.abs(notes[notes.length - 1] - prev[prev.length - 1]) : Math.abs(notes[0] - 57);
      if (cost < bestCost) {
        bestCost = cost;
        best = notes;
      }
    }
  }
  return best;
}

// ---- small helpers ----

/** deterministic per bar, so a vamp does not sound like a stuck loop yet stays repeatable */
function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const third = (c: Chord) => chordType(c.type).intervals[1];
const fifth = (c: Chord) => chordType(c.type).intervals[2];
const seventh = (c: Chord) => chordType(c.type).intervals[3] ?? 12;

// ---- the styles ----

export function generateBar(
  style: StyleId,
  chord: Chord,
  next: Chord,
  bar: number,
  bpm: number,
  state: StyleState,
): AccompEvent[] {
  const r = rng(bar + 1);
  const ev: AccompEvent[] = [];
  const sw = (beat: number) => {
    // swing the off-beat eighths (x.5)
    if (style !== 'swing') return beat;
    const whole = Math.floor(beat);
    return Math.abs(beat - whole - 0.5) < 1e-6 ? whole + swingRatio(bpm) : beat;
  };
  const bassRoot = chord.bassPc ?? chord.rootPc;

  if (style === 'swing') {
    // walking bass: root on 1, chord tones on 2 and 3, a half step into the next root on 4
    const b1 = nearest(bassRoot, state.bass, BASS_LO, BASS_HI);
    const target = nearest(next.bassPc ?? next.rootPc, b1, BASS_LO + 1, BASS_HI - 1);
    const b4 = target + (r() < 0.5 ? -1 : 1);
    const toward = (p: number, from: number) => nearest(p, from + (b4 - from) / 2, BASS_LO, BASS_HI);
    const b2 = toward(pc(chord, r() < 0.5 ? third(chord) : fifth(chord)), b1);
    const b3 = toward(pc(chord, r() < 0.6 ? fifth(chord) : seventh(chord)), b2);
    [b1, b2, b3, b4].forEach((m, i) => ev.push({ part: 'bass', beat: i, dur: 0.9, midi: m, vel: i === 0 ? 0.85 : 0.7 }));
    state.bass = b4;

    // comping: a few short stabs; a stab on the last off-beat anticipates the next chord
    const patterns = [
      [[0, 0.7]],
      [[1.5, 0.4], [3.5, 0.5]],
      [[0, 0.5], [1.5, 0.4]],
      [[1, 0.4], [2.5, 0.4]],
      [[2.5, 0.5]],
      [[0.5, 0.4], [2, 0.6]],
    ];
    const pat = patterns[Math.floor(r() * patterns.length)];
    for (const [beat, dur] of pat) {
      const anticipate = beat >= 3.5;
      const voicing = placeVoicing(anticipate ? next : chord, state.voicing);
      ev.push({ part: 'piano', beat: sw(beat), dur, midis: voicing, vel: 0.45 + r() * 0.2 });
      state.voicing = voicing;
    }

    // ride "ding, ding-a ding, ding-a", hi-hat foot on 2 and 4, an occasional brush
    for (const [beat, vel] of [
      [0, 0.75],
      [1, 0.65],
      [1.5, 0.45],
      [2, 0.75],
      [3, 0.65],
      [3.5, 0.45],
    ] as const) {
      ev.push({ part: 'drums', beat: sw(beat), sound: 'ride', vel });
    }
    ev.push({ part: 'drums', beat: 1, sound: 'hatFoot', vel: 0.6 }, { part: 'drums', beat: 3, sound: 'hatFoot', vel: 0.6 });
    if (r() < 0.35) ev.push({ part: 'drums', beat: sw(2.5), sound: 'brush', vel: 0.35 });
  }

  if (style === 'bossa') {
    // root on 1, fifth on the "and" of 2 and on 3, root again on the "and" of 4
    const root = nearest(bassRoot, state.bass, BASS_LO, BASS_HI - 7);
    const five = root + fifth(chord) - (fifth(chord) > 7 ? 0 : 0);
    const fiveLow = five - 12 >= BASS_LO ? five - 12 : five;
    ev.push(
      { part: 'bass', beat: 0, dur: 1.4, midi: root, vel: 0.85 },
      { part: 'bass', beat: 1.5, dur: 0.45, midi: fiveLow, vel: 0.7 },
      { part: 'bass', beat: 2, dur: 1.4, midi: fiveLow, vel: 0.75 },
      { part: 'bass', beat: 3.5, dur: 0.45, midi: root, vel: 0.65 },
    );
    state.bass = root;
    // two-bar syncopated comping
    const pat = bar % 2 === 0 ? [[0, 0.45], [1.5, 0.45], [3, 0.45]] : [[0.5, 0.45], [2, 0.45], [3.5, 0.45]];
    for (const [beat, dur] of pat) {
      const voicing = placeVoicing(beat >= 3.5 ? next : chord, state.voicing);
      ev.push({ part: 'piano', beat, dur, midis: voicing, vel: 0.45 });
      state.voicing = voicing;
    }
    for (let i = 0; i < 8; i++) ev.push({ part: 'drums', beat: i / 2, sound: 'hatClosed', vel: i % 2 ? 0.35 : 0.5 });
    for (const beat of bar % 2 === 0 ? [0, 1.5, 3] : [1, 2.5]) ev.push({ part: 'drums', beat, sound: 'rim', vel: 0.6 });
    for (const [beat, vel] of [
      [0, 0.7],
      [1.5, 0.4],
      [2, 0.6],
      [3.5, 0.4],
    ] as const) {
      ev.push({ part: 'drums', beat, sound: 'kick', vel });
    }
  }

  if (style === 'pop') {
    const root = nearest(bassRoot, state.bass, BASS_LO, BASS_HI);
    for (let i = 0; i < 8; i++) {
      const octave = i === 5 && r() < 0.5 ? 12 : 0;
      ev.push({ part: 'bass', beat: i / 2, dur: 0.45, midi: Math.min(BASS_HI + 7, root + octave), vel: i % 2 ? 0.6 : 0.8 });
    }
    state.bass = root;
    const voicing = popVoicing(chord, state.voicing);
    ev.push({ part: 'piano', beat: 0, dur: 1.9, midis: voicing, vel: 0.55 }, { part: 'piano', beat: 2, dur: 1.9, midis: voicing, vel: 0.5 });
    state.voicing = voicing;
    for (let i = 0; i < 8; i++) ev.push({ part: 'drums', beat: i / 2, sound: 'hatClosed', vel: i % 2 ? 0.35 : 0.55 });
    ev.push(
      { part: 'drums', beat: 0, sound: 'kick', vel: 0.85 },
      { part: 'drums', beat: 2, sound: 'kick', vel: 0.75 },
      { part: 'drums', beat: 2.5, sound: 'kick', vel: 0.55 },
      { part: 'drums', beat: 1, sound: 'snare', vel: 0.75 },
      { part: 'drums', beat: 3, sound: 'snare', vel: 0.75 },
    );
  }

  // humanise: a few milliseconds and a little velocity, never before the bar
  return ev.map((e) => ({
    ...e,
    beat: Math.max(0, Math.min(BEATS - 0.01, e.beat + (r() - 0.5) * 0.012 * (bpm / 60))),
    vel: Math.min(1, Math.max(0.05, e.vel + (r() - 0.5) * 0.12)),
  }));
}
