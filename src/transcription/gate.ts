import type { Envelope, NoteEvent } from './types';

/** A note as the lanes show it: possibly shortened, and muted when filtered out. */
export interface DisplayNote extends NoteEvent {
  /** left out of the notation (too weak, or started in silence) */
  muted: boolean;
}

const ONSET_WINDOW: readonly [number, number] = [-0.02, 0.06]; // seconds around the onset
const MIN_KEEP = 0.04; // never trim a note below this

/**
 * Silence gate. Basic Pitch also hears very quiet sound (room echo, a decaying
 * tail) that is barely visible in the waveform and not heard as playing. Anything
 * below `gateDb` relative to the loudest frame counts as silence: notes that start
 * there are muted, and notes that ring into it end where the silence begins.
 */
export function applyGate(
  notes: NoteEvent[],
  envelope: Envelope | null,
  gateDb: number,
  minStrength: number,
): DisplayNote[] {
  if (!envelope || envelope.rms.length === 0) {
    return notes.map((n) => ({ ...n, muted: n.amplitude < minStrength }));
  }
  const { rms, rate } = envelope;
  let peak = 0;
  for (let i = 0; i < rms.length; i++) if (rms[i] > peak) peak = rms[i];
  const floor = peak * 10 ** (gateDb / 20);
  const frame = (t: number) => Math.min(rms.length - 1, Math.max(0, Math.floor(t * rate)));

  return notes.map((n) => {
    let onset = 0;
    for (let f = frame(n.start + ONSET_WINDOW[0]); f <= frame(n.start + ONSET_WINDOW[1]); f++) {
      if (rms[f] > onset) onset = rms[f];
    }
    if (onset < floor) return { ...n, muted: true };

    let duration = n.duration;
    const last = frame(n.start + n.duration);
    for (let f = frame(n.start + MIN_KEEP); f <= last; f++) {
      if (rms[f] < floor) {
        duration = Math.max(MIN_KEEP, f / rate - n.start);
        break;
      }
    }
    return { ...n, duration, muted: n.amplitude < minStrength };
  });
}
