import type { Peaks } from '../../audio/peaks';
import { formatTime } from '../../lib/format';
import { noteName, STANDARD_TUNING } from '../../transcription/notes';
import type { NoteEvent } from '../../transcription/types';
import { palette } from '../../theme/palette';

/** [major tick in seconds, minor subdivisions] */
const TICKS: ReadonlyArray<readonly [number, number]> = [
  [0.05, 5],
  [0.1, 5],
  [0.25, 5],
  [0.5, 5],
  [1, 4],
  [2, 4],
  [5, 5],
  [10, 5],
  [15, 3],
  [30, 6],
  [60, 6],
  [120, 4],
  [300, 5],
  [600, 5],
];

const MIN_LABEL_PX = 84;

export function tickSpacing(pps: number) {
  const [major, divisions] =
    TICKS.find(([seconds]) => seconds * pps >= MIN_LABEL_PX) ?? TICKS[TICKS.length - 1];
  return { major, divisions, minor: major / divisions };
}

export function drawRuler(
  ctx: CanvasRenderingContext2D,
  scrollLeft: number,
  width: number,
  height: number,
  pps: number,
  duration: number,
) {
  const { major, divisions, minor } = tickSpacing(pps);
  const t0 = scrollLeft / pps;
  const t1 = (scrollLeft + width) / pps;
  const decimals = major < 0.1 ? 2 : major < 1 ? 1 : 0;

  ctx.font = "500 11px 'Instrument Sans Variable', system-ui, sans-serif";
  ctx.textBaseline = 'alphabetic';

  for (let i = Math.max(0, Math.floor(t0 / minor)); ; i++) {
    const t = i * minor;
    if (t > t1 || t > duration + 1e-6) break;
    const x = Math.round(t * pps - scrollLeft);
    const isMajor = i % divisions === 0;
    const tickH = isMajor ? 12 : 6;
    ctx.fillStyle = isMajor ? 'rgba(241,230,204,0.5)' : 'rgba(241,230,204,0.22)';
    ctx.fillRect(x, height - tickH, 1, tickH);
    if (isMajor) {
      ctx.fillStyle = palette.parchmentMuted;
      ctx.fillText(formatTime(t, decimals), x + 5, 14);
    }
  }
}

/** Faint vertical lines under the waveform, aligned with the ruler's major ticks. */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  scrollLeft: number,
  width: number,
  height: number,
  pps: number,
  duration: number,
) {
  const { major } = tickSpacing(pps);
  const t1 = (scrollLeft + width) / pps;
  ctx.fillStyle = 'rgba(241,230,204,0.055)';
  for (let i = Math.max(0, Math.floor(scrollLeft / pps / major)); ; i++) {
    const t = i * major;
    if (t > t1 || t > duration + 1e-6) break;
    ctx.fillRect(Math.round(t * pps - scrollLeft), 0, 1, height);
  }
}

export type WaveTone = 'dim' | 'lit';

/**
 * Draws the visible window of the waveform. The "dim" pass (with grid and centre
 * line) sits underneath; the "lit" pass is clipped to the played part by the playhead.
 */
export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  tone: WaveTone,
  scrollLeft: number,
  width: number,
  height: number,
  pps: number,
  peaks: Peaks,
) {
  const mid = height / 2;
  const amp = mid - 8;

  if (tone === 'dim') {
    drawGrid(ctx, scrollLeft, width, height, pps, peaks.duration);
    ctx.fillStyle = 'rgba(241,230,204,0.07)';
    ctx.fillRect(0, Math.round(mid), width, 1);
  }

  const [edge, core] =
    tone === 'lit' ? [palette.brass, palette.honeyLight] : [palette.dimEdge, palette.dimCore];
  const gradient = ctx.createLinearGradient(0, mid - amp, 0, mid + amp);
  gradient.addColorStop(0, edge);
  gradient.addColorStop(0.5, core);
  gradient.addColorStop(1, edge);
  ctx.fillStyle = gradient;

  const { min, max, rate, gain } = peaks;
  const buckets = max.length;

  for (let x = 0; x < width; x += 1) {
    const ta = (scrollLeft + x) / pps;
    if (ta >= peaks.duration) break;
    const tb = (scrollLeft + x + 1) / pps;
    const first = Math.min(buckets - 1, Math.floor(ta * rate));
    const last = Math.min(buckets, Math.max(first + 1, Math.ceil(tb * rate)));
    let lo = 0;
    let hi = 0;
    for (let i = first; i < last; i++) {
      if (min[i] < lo) lo = min[i];
      if (max[i] > hi) hi = max[i];
    }
    const top = mid - Math.min(1, hi * gain) * amp;
    const bottom = mid - Math.max(-1, lo * gain) * amp;
    ctx.fillRect(x, top, 1, Math.max(1, bottom - top));
  }
}

/** Pitch window of the notes lane plus a lookup helper for the visible slice. */
export interface NoteLayout {
  notes: NoteEvent[];
  low: number;
  high: number;
  /** longest note, so the visible slice can start a little early */
  maxDuration: number;
}

const GUITAR_LOW: number = STANDARD_TUNING[0];
const GUITAR_HIGH: number = 76; // E5, 12th fret on the high E string
const MIN_SPAN = 24;

export function layoutNotes(notes: NoteEvent[]): NoteLayout {
  let low = GUITAR_LOW;
  let high = GUITAR_HIGH;
  let maxDuration = 0;
  for (const n of notes) {
    if (n.midi < low) low = n.midi;
    if (n.midi > high) high = n.midi;
    if (n.duration > maxDuration) maxDuration = n.duration;
  }
  low -= 1;
  high += 1;
  if (high - low < MIN_SPAN) high = low + MIN_SPAN;
  return { notes, low, high, maxDuration };
}

/** first index whose start is >= t (notes are sorted by start) */
function lowerBound(notes: NoteEvent[], t: number) {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].start < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Piano-roll view of the detected notes. Like the waveform it has a "dim" pass
 * (with the open-string lines) and a "lit" pass that the playhead reveals.
 */
export function drawNotes(
  ctx: CanvasRenderingContext2D,
  tone: WaveTone,
  scrollLeft: number,
  width: number,
  height: number,
  pps: number,
  duration: number,
  layout: NoteLayout,
) {
  const pad = 6;
  const rows = layout.high - layout.low + 1;
  const rowH = (height - pad * 2) / rows;
  const yOf = (midi: number) => pad + (layout.high - midi) * rowH;

  if (tone === 'dim') {
    drawGrid(ctx, scrollLeft, width, height, pps, duration);
    // the six open strings as faint "strings" across the lane
    ctx.font = "500 10px 'Instrument Sans Variable', system-ui, sans-serif";
    ctx.textBaseline = 'middle';
    for (const open of STANDARD_TUNING) {
      if (open < layout.low || open > layout.high) continue;
      const y = Math.round(yOf(open) + rowH / 2);
      ctx.fillStyle = 'rgba(168,147,90,0.16)';
      ctx.fillRect(0, y, width, 1);
      ctx.fillStyle = 'rgba(191,174,142,0.55)';
      ctx.fillText(noteName(open), 4, y - 6);
    }
  }

  const t0 = scrollLeft / pps;
  const t1 = (scrollLeft + width) / pps;
  const { notes } = layout;
  const barH = Math.max(3, rowH - 1);
  const radius = Math.min(3, barH / 2);
  const showNames = barH >= 9;
  if (showNames) {
    ctx.font = "600 9px 'Instrument Sans Variable', system-ui, sans-serif";
    ctx.textBaseline = 'middle';
  }

  for (let i = lowerBound(notes, t0 - layout.maxDuration); i < notes.length; i++) {
    const n = notes[i];
    if (n.start > t1) break;
    if (n.start + n.duration < t0) continue;
    const x = n.start * pps - scrollLeft;
    const w = Math.max(2, n.duration * pps - 1);
    const y = yOf(n.midi);
    const alpha = (tone === 'lit' ? 0.5 : 0.35) + 0.5 * Math.min(1, n.amplitude * 1.6);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = tone === 'lit' ? palette.honeyLight : palette.tweed;
    ctx.beginPath();
    ctx.roundRect(x, y, w, barH, radius);
    ctx.fill();
    ctx.globalAlpha = 1;
    // leading edge marks the onset
    ctx.fillStyle = tone === 'lit' ? palette.brass : palette.dimEdge;
    ctx.fillRect(x, y, Math.min(2, w), barH);

    if (showNames && w >= 26) {
      ctx.fillStyle = tone === 'lit' ? palette.espresso : 'rgba(20,13,9,0.8)';
      ctx.fillText(noteName(n.midi), x + 5, y + barH / 2 + 0.5);
    }
  }
}
