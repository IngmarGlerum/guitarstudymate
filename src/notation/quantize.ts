import type { NoteEvent } from '../transcription/types';
import { tickDuration, TICKS_PER_BEAT, type Tempo } from './tempo';

/** One written symbol inside a bar: a note/chord, or a rest when `midis` is null. */
export interface Piece {
  /** position in the bar, in sixteenths */
  tick: number;
  /** length in sixteenths; always one of WRITABLE */
  ticks: number;
  /** sounding MIDI pitches, low to high; null = rest */
  midis: number[] | null;
  /** tied to the next piece (same pitches) */
  tie: boolean;
  /**
   * Let ring: per pitch (aligned with `midis`), how many sixteenths the note keeps
   * sounding after this piece ends. Only set on the last piece of a note that was
   * cut short by the next onset.
   */
  ring?: number[];
  /** whole-bar rest, drawn centred */
  wholeBarRest?: boolean;
}

export interface Bar {
  index: number;
  pieces: Piece[];
}

/** sixteenths -> VexFlow duration (without the rest suffix) */
export const WRITABLE: Record<number, string> = {
  16: 'w',
  12: 'hd',
  8: 'h',
  6: 'qd',
  4: 'q',
  3: '8d',
  2: '8',
  1: '16',
};
const LENGTHS = Object.keys(WRITABLE)
  .map(Number)
  .sort((a, b) => b - a);

interface Span {
  start: number; // absolute tick from the downbeat
  end: number;
  midis: number[] | null;
  /** real end per pitch, may lie past `end` (let ring) */
  ends?: number[];
}

/**
 * Snap notes to a sixteenth grid and turn them into a single rhythmic voice:
 * notes that start on the same sixteenth form a chord, and a chord is written
 * until the next onset. A note that keeps sounding past that onset gets a
 * let-ring length (`Piece.ring`) instead of a second voice. Gaps become rests.
 */
export function quantize(notes: NoteEvent[], tempo: Tempo & { bpm: number }): Bar[] {
  if (notes.length === 0) return [];
  const tick = tickDuration(tempo.bpm);
  const barTicks = tempo.beatsPerBar * TICKS_PER_BEAT;

  // group onsets
  // onset tick -> (pitch -> end tick)
  const chords = new Map<number, { ends: Map<number, number>; end: number }>();
  for (const n of notes) {
    const start = Math.round((n.start - tempo.downbeat) / tick);
    const end = Math.max(start + 1, Math.round((n.start + n.duration - tempo.downbeat) / tick));
    const chord = chords.get(start);
    if (chord) {
      chord.ends.set(n.midi, Math.max(end, chord.ends.get(n.midi) ?? 0));
      chord.end = Math.max(chord.end, end);
    } else {
      chords.set(start, { ends: new Map([[n.midi, end]]), end });
    }
  }
  const onsets = [...chords.keys()].sort((a, b) => a - b);

  // a ringing note stops when the same pitch is struck again
  onsets.forEach((start, i) => {
    for (const [midi, end] of chords.get(start)!.ends) {
      for (let j = i + 1; j < onsets.length && onsets[j] < end; j++) {
        if (chords.get(onsets[j])!.ends.has(midi)) {
          chords.get(start)!.ends.set(midi, onsets[j]);
          break;
        }
      }
    }
  });

  const firstBar = Math.floor(onsets[0] / barTicks);
  let lastEnd = 0;
  const spans: Span[] = [];
  let cursor = firstBar * barTicks;
  onsets.forEach((start, i) => {
    const chord = chords.get(start)!;
    const end = Math.min(chord.end, onsets[i + 1] ?? Infinity);
    const midis = [...chord.ends.keys()].sort((a, b) => a - b);
    if (start > cursor) spans.push({ start: cursor, end: start, midis: null });
    spans.push({ start, end, midis, ends: midis.map((m) => chord.ends.get(m)!) });
    cursor = end;
    lastEnd = end;
  });
  const lastBar = Math.floor((lastEnd - 1) / barTicks);
  const total = (lastBar + 1) * barTicks;
  if (cursor < total) spans.push({ start: cursor, end: total, midis: null });

  const bars: Bar[] = [];
  for (let b = firstBar; b <= lastBar; b++) bars.push({ index: b, pieces: [] });

  for (const span of spans) {
    let s = span.start;
    while (s < span.end) {
      const barIndex = Math.floor(s / barTicks);
      const barEnd = (barIndex + 1) * barTicks;
      const e = Math.min(span.end, barEnd);
      const bar = bars[barIndex - firstBar];
      const lengths = splitInBar(s - barIndex * barTicks, e - s, tempo.beatsPerBar);
      let t = s - barIndex * barTicks;
      lengths.forEach((len, i) => {
        const lastOfSpan = e === span.end && i === lengths.length - 1;
        const ring = lastOfSpan && span.ends ? span.ends.map((x) => Math.max(0, x - span.end)) : [];
        bar.pieces.push({
          tick: t,
          ticks: len,
          midis: span.midis,
          tie: span.midis !== null && !lastOfSpan,
          ...(ring.some((r) => r > 0) ? { ring } : {}),
        });
        t += len;
      });
      s = e;
    }
  }

  for (const bar of bars) {
    if (bar.pieces.every((p) => p.midis === null)) {
      bar.pieces = [{ tick: 0, ticks: barTicks, midis: null, tie: false, wholeBarRest: true }];
    }
  }
  return bars;
}

/**
 * Break a stretch inside one bar into writable lengths. A piece that starts
 * off the beat stops at the next beat; in 4/4 nothing but a bar-long value
 * crosses the middle of the bar. That keeps the beat visible, at the cost of ties.
 */
export function splitInBar(start: number, length: number, beatsPerBar: number): number[] {
  const out: number[] = [];
  const half = beatsPerBar === 4 ? 2 * TICKS_PER_BEAT : Infinity;
  let s = start;
  let left = length;
  while (left > 0) {
    let limit = left;
    if (s % TICKS_PER_BEAT !== 0) {
      limit = Math.min(limit, TICKS_PER_BEAT - (s % TICKS_PER_BEAT));
    } else if (s !== 0 && s < half) {
      limit = Math.min(limit, half - s);
    }
    const len = LENGTHS.find((l) => l <= limit)!;
    out.push(len);
    s += len;
    left -= len;
  }
  return out;
}
