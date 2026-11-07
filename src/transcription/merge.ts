import type { NoteEvent } from './types';

/** gap (s) between two same-pitch notes that still counts as "touching" */
const TOUCH_GAP = 0.035;
/**
 * A real new pick raises the energy at the pitch's fundamental; a model cut does
 * not. Measured: cuts in the 95 BPM riff sample −1.1…−0.4 dB, real re-picks in a
 * synthetic test +1.3…+2.3 dB. The margin is small; see CLAUDE.md.
 */
const REATTACK_DB = 0.6;
const WINDOW_S = 0.046;

/** Energy at one frequency over a window (Goertzel). The octave is left out: it
 *  picks up other strings' partials and hid the difference between cut and pick. */
function bandEnergy(samples: Float32Array, rate: number, start: number, freq: number) {
  const n = Math.round(WINDOW_S * rate);
  const i0 = Math.max(0, Math.round(start * rate));
  const i1 = Math.min(samples.length, i0 + n);
  if (i1 - i0 < n / 2) return 0;
  let total = 0;
  for (const f of [freq]) {
    const w = (2 * Math.PI * f) / rate;
    const coeff = 2 * Math.cos(w);
    let s1 = 0;
    let s2 = 0;
    for (let i = i0; i < i1; i++) {
      // Hann window keeps neighbouring pitches from leaking in
      const win = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - i0)) / (i1 - i0 - 1));
      const s0 = samples[i] * win + coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    total += s1 * s1 + s2 * s2 - coeff * s1 * s2;
  }
  return total;
}

/**
 * Basic Pitch sometimes cuts one sustained note into several touching notes of the
 * same pitch, often where other strings are struck. Join such pieces again unless
 * the pitch's own energy jumps at the cut, which is what a real new pick does.
 */
export function mergeSustained(
  notes: NoteEvent[],
  samples: Float32Array,
  rate: number,
): { notes: NoteEvent[]; merged: number } {
  const byPitch = new Map<number, NoteEvent[]>();
  for (const n of notes) {
    const list = byPitch.get(n.midi);
    if (list) list.push({ ...n });
    else byPitch.set(n.midi, [{ ...n }]);
  }
  const out: NoteEvent[] = [];
  let merged = 0;
  for (const [midi, list] of byPitch) {
    list.sort((a, b) => a.start - b.start);
    const freq = 440 * 2 ** ((midi - 69) / 12);
    let cur = list[0];
    for (let i = 1; i < list.length; i++) {
      const next = list[i];
      const gap = next.start - (cur.start + cur.duration);
      let join = false;
      if (gap < TOUCH_GAP) {
        const before = bandEnergy(samples, rate, next.start - WINDOW_S - 0.005, freq);
        const after = bandEnergy(samples, rate, next.start + 0.01, freq);
        const riseDb = 10 * Math.log10((after + 1e-12) / (before + 1e-12));
        join = riseDb < REATTACK_DB;
      }
      if (join) {
        const end = Math.max(cur.start + cur.duration, next.start + next.duration);
        const w1 = cur.duration;
        const w2 = next.duration;
        cur.amplitude = (cur.amplitude * w1 + next.amplitude * w2) / (w1 + w2);
        cur.duration = end - cur.start;
        merged += 1;
      } else {
        out.push(cur);
        cur = next;
      }
    }
    out.push(cur);
  }
  out.sort((a, b) => a.start - b.start || a.midi - b.midi);
  return { notes: out, merged };
}
