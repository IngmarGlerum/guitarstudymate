import { parseChord, type Chord } from './chords';

const BEATS_PER_BAR = 4;

/**
 * Progressions (requirements P): a list of bars, each with one or more chords and
 * their beats. Built-in forms, typed text and (later) iReal Pro all end up here.
 */

export interface BarChord {
  chord: Chord;
  beats: number;
}
export type Bar = BarChord[];

/** One chord on the timeline. */
export interface Segment {
  chord: Chord;
  /** beat where it starts, counted from the start of the progression */
  start: number;
  beats: number;
  /** 0-based bar it starts in */
  bar: number;
  /** text as typed, e.g. "G7alt", for display and error messages */
  text: string;
}

export interface ParsedProgression {
  bars: Bar[];
  /** bars as text, for chord labels above the staff */
  barTexts: string[][];
  unknown: string[];
}

/**
 * "Dm7 G7 | Cmaj7 | % | Am7": bars split by "|", chords within a bar share its beats
 * equally, "%" repeats the previous bar. Without any "|", every chord is one bar.
 */
export function parseProgression(text: string): ParsedProgression {
  const hasBars = text.includes('|');
  const rawBars = hasBars
    ? text.split('|').map((b) => b.trim()).filter(Boolean)
    : text.split(/[\s,]+/).map((b) => b.trim()).filter(Boolean);
  const bars: Bar[] = [];
  const barTexts: string[][] = [];
  const unknown: string[] = [];
  for (const raw of rawBars) {
    if (raw === '%' && bars.length) {
      bars.push(bars[bars.length - 1]);
      barTexts.push(barTexts[barTexts.length - 1]);
      continue;
    }
    const tokens = raw.split(/\s+/).filter(Boolean);
    const chords: { chord: Chord; text: string }[] = [];
    for (const t of tokens) {
      const c = parseChord(t);
      if (c) chords.push({ chord: c, text: t });
      else unknown.push(t);
    }
    if (!chords.length) continue;
    // split the bar's beats as evenly as whole beats allow (4 → 2+2, 3 chords → 2+1+1)
    const base = Math.floor(BEATS_PER_BAR / chords.length);
    let extra = BEATS_PER_BAR - base * chords.length;
    bars.push(
      chords.map(({ chord }) => {
        const beats = base + (extra > 0 ? 1 : 0);
        extra -= 1;
        return { chord, beats: Math.max(1, beats) };
      }),
    );
    barTexts.push(chords.map((c) => c.text));
  }
  return { bars, barTexts, unknown };
}

export function segmentsOf(bars: Bar[], barTexts: string[][]): Segment[] {
  const out: Segment[] = [];
  let beat = 0;
  bars.forEach((bar, b) => {
    bar.forEach((bc, i) => {
      out.push({ chord: bc.chord, start: beat, beats: bc.beats, bar: b, text: barTexts[b]?.[i] ?? '' });
      beat += bc.beats;
    });
  });
  return out;
}

/** Built-in forms, named after the form rather than a song (P-9). */
export const BUILTIN_PROGRESSIONS: { id: string; label: string; text: string }[] = [
  { id: 'ii-v-i-major', label: 'ii–V–I majeur, 4 maten', text: 'Dm7 | G7 | Cmaj7 | Cmaj7' },
  { id: 'ii-v-i-minor', label: 'ii–V–i mineur', text: 'Dm7b5 | G7b9 | Cm6 | Cm6' },
  {
    id: 'ii-v-i-keys',
    label: 'ii–V–I door meerdere toonsoorten',
    text: 'Dm7 | G7 | Cmaj7 | Cmaj7 | Cm7 | F7 | Bbmaj7 | Bbmaj7 | Bbm7 | Eb7 | Abmaj7 | Abmaj7',
  },
  { id: 'turnaround', label: 'Turnaround I–vi–ii–V', text: 'Cmaj7 | Am7 | Dm7 | G7' },
  {
    id: 'jazz-blues',
    label: 'Jazzblues, 12 maten (F)',
    text: 'F7 | Bb7 | F7 | Cm7 F7 | Bb7 | Bdim7 | F7 | Am7 D7 | Gm7 | C7 | F7 D7 | Gm7 C7',
  },
  {
    id: 'cycle',
    label: 'Kwintencirkel, majeur en mineur',
    text: 'Cmaj7 | Fmaj7 | Bm7b5 | E7 | Am7 | Dm7 | G7 | Cmaj7',
  },
  {
    id: 'rhythm-changes',
    label: 'Rhythm changes: A-deel en bridge (B♭)',
    text: 'Bbmaj7 Gm7 | Cm7 F7 | Dm7 G7 | Cm7 F7 | Fm7 Bb7 | Ebmaj7 Edim7 | Dm7 G7 | Cm7 F7 | D7 | D7 | G7 | G7 | C7 | C7 | F7 | F7',
  },
  {
    id: 'major-thirds',
    label: "Modulerende ii–V's in grote tertsen",
    text: 'Dm7 G7 | Cmaj7 | F#m7 B7 | Emaj7 | Bbm7 Eb7 | Abmaj7 | Dm7 G7 | Cmaj7',
  },
];
