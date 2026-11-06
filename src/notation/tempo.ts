/** User-supplied tempo grid. We never detect tempo automatically. */
export interface Tempo {
  /** quarter notes per minute; null until the user enters or taps one */
  bpm: number | null;
  /** quarter-note beats per bar (2/4, 3/4, 4/4) */
  beatsPerBar: number;
  /** time in seconds of a downbeat (beat 1 of some bar); bars repeat from here both ways */
  downbeat: number;
}

export const BPM_MIN = 30;
export const BPM_MAX = 300;
export const METERS = [2, 3, 4] as const;

/** sixteenth notes per quarter: the quantisation grid */
export const TICKS_PER_BEAT = 4;

export const beatDuration = (bpm: number) => 60 / bpm;
export const barDuration = (t: { bpm: number; beatsPerBar: number }) =>
  t.beatsPerBar * beatDuration(t.bpm);
export const tickDuration = (bpm: number) => beatDuration(bpm) / TICKS_PER_BEAT;

/** start time of bar `index`; index 0 starts at the downbeat, negative bars come before it */
export const barStart = (t: Tempo & { bpm: number }, index: number) =>
  t.downbeat + index * barDuration(t);

/**
 * Tap tempo: average of the recent intervals. A pause longer than `resetAfter`
 * starts a new measurement. Returns null until there are two taps.
 */
export function createTapper(resetAfter = 2, keep = 8) {
  let taps: number[] = [];
  return (now: number): number | null => {
    if (taps.length > 0 && now - taps[taps.length - 1] > resetAfter) taps = [];
    taps.push(now);
    if (taps.length > keep) taps.shift();
    if (taps.length < 2) return null;
    const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
    return Math.round(60 / avg);
  };
}
