import { useCallback, useState } from 'react';
import type { Chord } from './chords';
import type { FretNote } from './fingering';
import { parseProgression } from './progressions';
import { MAX_FRET, TUNING } from './theory';

/**
 * Licks as practice material. The licks themselves are not part of the app: the
 * user imports a file (`guitar-study-mate/licks`), which stays in this browser.
 *
 * A lick's notes are a short text, bar by bar:
 *   "e5/8 d5 c5 b4 | g4/4. (3 f4/8 g4 f4) | c4/2~ c4/4 r/4"
 * - a pitch is a letter, an optional accidental (# b ## bb n) and the written octave
 *   (guitar notation: middle C is c4, sounding an octave lower); r is a rest
 * - /1 /2 /4 /8 /16 set the duration, a dot makes it dotted; it carries over to the
 *   next notes until it changes
 * - ~ ties the note to the next one, (3 … ) is a triplet (durations × 2/3)
 * - | separates bars; every bar must add up to 4/4
 */

export const LICKS_FORMAT = 'guitar-study-mate/licks';
export const TICKS_PER_BEAT = 12; // quarter = 12: eighths, sixteenths and triplets fit
export const BAR_TICKS = 4 * TICKS_PER_BEAT;

export interface Lick {
  /** the number in the source, so a reading can be checked against it */
  number: number;
  title?: string;
  /** chord symbols, bars separated by |; a lick with one chord may give it once */
  chords: string;
  notes: string;
  /** e.g. "voorslag weggelaten" */
  remark?: string;
}

export interface LickFile {
  format: typeof LICKS_FORMAT;
  version: 1;
  source?: string;
  licks: Lick[];
}

export interface LickEvent {
  /** written MIDI (guitar sounds an octave lower); null = rest */
  written: number | null;
  /** spelling of the written note: letter and accidental */
  letter: string;
  accidental: '' | '#' | 'b' | '##' | 'bb' | 'n';
  start: number;
  dur: number;
  /** tied to the next event */
  tie: boolean;
  /** index of the triplet group, or -1 */
  tuplet: number;
}

const LETTER_PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const ACC_SHIFT: Record<string, number> = { '': 0, n: 0, '#': 1, '##': 2, b: -1, bb: -2 };
const DUR: Record<string, number> = { '1': 48, '2': 24, '4': 12, '8': 6, '16': 3, '32': 1.5 };

/** Parse the note text. Errors name the bar, so a misreading is easy to find. */
export function parseLickNotes(text: string): { events: LickEvent[]; bars: number; errors: string[] } {
  const events: LickEvent[] = [];
  const errors: string[] = [];
  const bars = text.split('|');
  let dur = 6;
  let dotted = false;
  let t = 0;
  let tupletId = 0;
  bars.forEach((barText, b) => {
    const barStart = b * BAR_TICKS;
    t = barStart;
    let inTuplet = -1;
    const tokens = barText.replace(/\(3/g, ' (3 ').replace(/\)/g, ' ) ').trim().split(/\s+/).filter(Boolean);
    for (const tok of tokens) {
      if (tok === '(3') {
        inTuplet = tupletId++;
        continue;
      }
      if (tok === ')') {
        inTuplet = -1;
        continue;
      }
      const m = tok.match(/^(r|([a-g])(##|bb|#|b|n)?(\d))(?:\/(1|2|4|8|16|32))?(\.)?(~)?$/i);
      if (!m) {
        errors.push(`Maat ${b + 1}: "${tok}" niet begrepen`);
        continue;
      }
      if (m[5]) {
        dur = DUR[m[5]];
        dotted = !!m[6];
      } else if (m[6]) dotted = true;
      let len = dotted ? dur * 1.5 : dur;
      if (inTuplet >= 0) len = (len * 2) / 3;
      const rest = m[1].toLowerCase() === 'r';
      const letter = rest ? 'b' : m[2].toLowerCase();
      const acc = (rest ? '' : (m[3] ?? '').toLowerCase()) as LickEvent['accidental'];
      const written = rest ? null : (Number(m[4]) + 1) * 12 + LETTER_PC[letter] + ACC_SHIFT[acc];
      events.push({ written, letter, accidental: acc, start: t, dur: len, tie: !!m[7], tuplet: inTuplet });
      t += len;
    }
    const used = Math.round((t - barStart) * 100) / 100;
    if (tokens.length && used !== BAR_TICKS) {
      errors.push(`Maat ${b + 1}: ${used / TICKS_PER_BEAT} tellen in plaats van 4`);
    }
  });
  return { events, bars: bars.length, errors };
}

export interface LickChord {
  chord: Chord;
  /** in beats from the start of the lick */
  start: number;
  beats: number;
}

/**
 * The chords on the lick's timeline. Bars split like progressions (chords in a
 * bar share its beats); missing bars repeat the last chord; the same chord in a
 * row is merged.
 */
export function lickChords(lick: Lick, bars: number): LickChord[] {
  const p = parseProgression(lick.chords);
  const given = p.bars.filter((b) => b.length);
  if (!given.length) return [];
  const out: LickChord[] = [];
  for (let b = 0; b < bars; b++) {
    const bar = given[b] ?? [{ chord: given[given.length - 1].at(-1)!.chord, beats: 4 }];
    let t = b * 4;
    for (const bc of bar) {
      const last = out[out.length - 1];
      if (last && last.chord.rootPc === bc.chord.rootPc && last.chord.type === bc.chord.type) last.beats += bc.beats;
      else out.push({ chord: bc.chord, start: t, beats: bc.beats });
      t += bc.beats;
    }
  }
  return out;
}

/** Root of the first chord: the lick's key for transposing. */
export const lickRoot = (lick: Lick) => lickChords(lick, 1)[0]?.chord.rootPc ?? 0;

/** Validate an imported file; returns the licks that could be read and messages. */
export function readLickFile(data: unknown): { licks: Lick[]; problems: string[] } {
  const problems: string[] = [];
  const d = data as Partial<LickFile> | null;
  if (!d || d.format !== LICKS_FORMAT || !Array.isArray(d.licks)) {
    return { licks: [], problems: ['Dit is geen licks-bestand van Guitar Study Mate.'] };
  }
  const licks: Lick[] = [];
  for (const raw of d.licks as Partial<Lick>[]) {
    const number = Number(raw?.number);
    if (!Number.isInteger(number) || typeof raw?.notes !== 'string' || typeof raw?.chords !== 'string') {
      problems.push(`Een lick zonder nummer, noten of akkoorden is overgeslagen.`);
      continue;
    }
    const { errors } = parseLickNotes(raw.notes);
    if (errors.length) problems.push(`Lick ${number}: ${errors.join('; ')}`);
    licks.push({
      number,
      chords: raw.chords,
      notes: raw.notes,
      ...(typeof raw.title === 'string' ? { title: raw.title } : {}),
      ...(typeof raw.remark === 'string' ? { remark: raw.remark } : {}),
    });
  }
  return { licks, problems };
}

const STORAGE_KEY = 'gsm.licks';

function loadLicks(): Lick[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? readLickFile(JSON.parse(raw)).licks : [];
  } catch {
    return [];
  }
}

/** The imported licks, kept in this browser only. A new import replaces licks with the same number. */
export function useLicks() {
  const [licks, setLicks] = useState<Lick[]>(loadLicks);
  const save = useCallback((next: Lick[]) => {
    const sorted = [...next].sort((a, b) => a.number - b.number);
    setLicks(sorted);
    try {
      const file: LickFile = { format: LICKS_FORMAT, version: 1, licks: sorted };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
    } catch {
      // storage unavailable: keep them for this visit
    }
  }, []);
  const importLicks = useCallback(
    (incoming: Lick[]) => {
      const byNumber = new Map(licks.map((l) => [l.number, l]));
      for (const l of incoming) byNumber.set(l.number, l);
      save([...byNumber.values()]);
    },
    [licks, save],
  );
  const clear = useCallback(() => save([]), [save]);
  return { licks, importLicks, clear };
}

// ---- transposing and placing on the fretboard ----

const SHARP_SPELL = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const FLAT_SPELL = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];

/**
 * Transpose by `shift` semitones. In the original key the book's spelling stays;
 * otherwise notes are spelled with sharps or flats after the new key.
 */
export function transposeEvents(events: LickEvent[], shift: number, flats: boolean): LickEvent[] {
  if (shift === 0) return events;
  return events.map((e) => {
    if (e.written === null) return e;
    const w = e.written + shift;
    const name = (flats ? FLAT_SPELL : SHARP_SPELL)[((w % 12) + 12) % 12];
    return { ...e, written: w, letter: name[0], accidental: (name.slice(1) as LickEvent['accidental']) || '' };
  });
}

/**
 * Strings and frets for the notes (one hand position, like the tab lane plan):
 * dynamic programming over every place of each note, with costs for leaving the
 * window, changing strings and moving the hand.
 */
export function fingerLick(sounding: number[], lo: number): FretNote[] {
  if (!sounding.length) return [];
  const places = sounding.map((midi) => {
    const out: { string: number; fret: number }[] = [];
    for (let s = 0; s < TUNING.length; s++) {
      const fret = midi - TUNING[s];
      if (fret >= 0 && fret <= MAX_FRET) out.push({ string: s, fret });
    }
    return out.length ? out : [{ string: 0, fret: Math.max(0, midi - TUNING[0]) }];
  });
  const own = (p: { fret: number }) => {
    const outside = Math.max(0, lo - 1 - p.fret, p.fret - (lo + 5));
    return outside * 3 + (p.fret === 0 && lo > 2 ? 2 : 0);
  };
  const move = (a: { string: number; fret: number }, b: { string: number; fret: number }) =>
    Math.abs(a.string - b.string) * 0.6 + Math.abs(a.fret - b.fret) * 0.35;
  let cost = places[0].map(own);
  const back: number[][] = [places[0].map(() => -1)];
  for (let i = 1; i < places.length; i++) {
    const next: number[] = [];
    const from: number[] = [];
    for (const p of places[i]) {
      let best = Infinity;
      let arg = 0;
      places[i - 1].forEach((q, k) => {
        const c = cost[k] + move(q, p);
        if (c < best) {
          best = c;
          arg = k;
        }
      });
      next.push(best + own(p));
      from.push(arg);
    }
    cost = next;
    back.push(from);
  }
  let k = cost.indexOf(Math.min(...cost));
  const out: FretNote[] = [];
  for (let i = places.length - 1; i >= 0; i--) {
    const p = places[i][k];
    out[i] = { midi: sounding[i], string: p.string, fret: p.fret, degree: 0 };
    k = back[i][k];
  }
  return out;
}

export interface LickExercise {
  events: LickEvent[];
  /** a fretboard place per sounding note (tied notes share the first one's) */
  places: (FretNote | null)[];
  /** fine grid for the engine: 12 slots per beat, a note (with its length) where it starts */
  slots: (FretNote | null)[];
  chords: LickChord[];
  bars: number;
  errors: string[];
}

/** Everything the exercise needs for one lick in one key and window. */
export function lickExercise(lick: Lick, shift: number, flats: boolean, lo: number): LickExercise {
  const parsed = parseLickNotes(lick.notes);
  const events = transposeEvents(parsed.events, shift, flats);
  const bars = Math.max(1, parsed.bars);
  // a tied note sounds once, for the length of the whole tie
  const heads: number[] = [];
  events.forEach((e, i) => {
    if (e.written === null) return;
    const prev = events[i - 1];
    if (prev?.tie && prev.written === e.written) return;
    heads.push(i);
  });
  const fingered = fingerLick(
    heads.map((i) => events[i].written! - 12),
    lo,
  );
  const places: (FretNote | null)[] = events.map(() => null);
  const slots: (FretNote | null)[] = new Array(bars * BAR_TICKS).fill(null);
  heads.forEach((i, h) => {
    let len = events[i].dur;
    for (let j = i; events[j]?.tie && events[j + 1]?.written === events[i].written; j++) {
      len += events[j + 1].dur;
      places[j + 1] = fingered[h];
    }
    const note: FretNote = { ...fingered[h], len };
    places[i] = note;
    const slot = Math.round(events[i].start);
    if (slot < slots.length) slots[slot] = note;
  });
  return {
    events,
    places,
    slots,
    chords: lickChords(lick, bars).map((c) => ({ ...c, chord: { ...c.chord, rootPc: (c.chord.rootPc + shift + 120) % 12 } })),
    bars,
    errors: parsed.errors,
  };
}
