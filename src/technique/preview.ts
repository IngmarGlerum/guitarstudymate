import { KarplusStrongGuitar } from './engine';

let ctx: AudioContext | null = null;
let guitar: KarplusStrongGuitar | null = null;
let bus: GainNode | null = null;

/**
 * Play notes right away when they are clicked (staff, tab, neck, piano roll).
 * One small shared AudioContext, created on the first click (a user gesture).
 */
export function previewNotes(midis: number[]) {
  if (midis.length === 0) return;
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    bus = ctx.createGain();
    bus.gain.value = 0.7;
    bus.connect(ctx.destination);
    guitar = new KarplusStrongGuitar(ctx, bus);
  }
  const c = ctx;
  const g = guitar!;
  const play = () => {
    const t = c.currentTime + 0.01;
    // a chord is strummed a little, low to high
    [...midis].sort((a, b) => a - b).forEach((m, i) => g.play(m, i, t + i * 0.018, 1.6));
  };
  if (c.state === 'running') play();
  else void c.resume().then(play);
}
