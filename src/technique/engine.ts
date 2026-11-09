import type { FretNote } from './fingering';
import { BEATS_PER_BAR, type Subdivision } from './exercise';

/**
 * The instrument behind a small interface, so the Karplus-Strong string can later
 * be swapped for samples without touching the scheduler.
 */
export interface Instrument {
  /** schedule a note; returns a handle that can be cut short */
  play(midi: number, string: number, time: number, duration: number | null): Voice;
}
export interface Voice {
  release(time: number): void;
}

const NOTE_SECONDS = 2.6;

/** Karplus-Strong plucked string, rendered once per pitch into an AudioBuffer. */
export class KarplusStrongGuitar implements Instrument {
  private cache = new Map<number, AudioBuffer>();
  private ctx: AudioContext;
  private out: AudioNode;
  constructor(ctx: AudioContext, out: AudioNode) {
    this.ctx = ctx;
    this.out = out;
  }

  private buffer(midi: number): AudioBuffer {
    const hit = this.cache.get(midi);
    if (hit) return hit;
    const sr = this.ctx.sampleRate;
    const freq = 440 * 2 ** ((midi - 69) / 12);
    const length = Math.floor(NOTE_SECONDS * sr);
    const y = new Float32Array(length);
    // The two-point average adds half a sample of delay; fractional read keeps pitch exact.
    const delay = sr / freq - 0.5;
    const n0 = Math.ceil(delay) + 2;
    // excitation: noise, softened a little for lower strings
    let prev = 0;
    const soft = Math.min(0.7, Math.max(0.2, (64 - midi) / 40 + 0.35));
    for (let i = 0; i < n0 && i < length; i++) {
      const white = Math.random() * 2 - 1;
      prev = prev * soft + white * (1 - soft);
      y[i] = prev;
    }
    // per-period loss for roughly a 2.2 s decay, independent of pitch
    const loss = 10 ** (-3 / (2.2 * freq));
    const read = (pos: number) => {
      const i = Math.floor(pos);
      const f = pos - i;
      return i < 0 ? 0 : y[i] * (1 - f) + (i + 1 < length ? y[i + 1] : 0) * f;
    };
    for (let n = n0; n < length; n++) {
      y[n] = loss * 0.5 * (read(n - delay) + read(n - delay - 1));
    }
    // normalise the attack so every pitch is about equally loud
    let peak = 0;
    for (let i = 0; i < Math.min(length, n0 * 4); i++) peak = Math.max(peak, Math.abs(y[i]));
    const gain = peak > 0 ? 0.6 / peak : 1;
    for (let i = 0; i < length; i++) y[i] *= gain;
    const buf = this.ctx.createBuffer(1, length, sr);
    buf.copyToChannel(y, 0);
    this.cache.set(midi, buf);
    return buf;
  }

  /** Render buffers ahead of playback so the first notes are not late. */
  prepare(midis: Iterable<number>) {
    for (const m of midis) this.buffer(m);
  }

  play(midi: number, _string: number, time: number, duration: number | null): Voice {
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer(midi);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.9, time);
    src.connect(env).connect(this.out);
    src.start(time);
    let stopped = false;
    const voice: Voice = {
      release: (t: number) => {
        if (stopped) return;
        stopped = true;
        env.gain.setTargetAtTime(0, t, 0.012);
        src.stop(t + 0.12);
      },
    };
    if (duration !== null) voice.release(time + duration);
    else src.stop(time + NOTE_SECONDS);
    return voice;
  }
}

function click(ctx: AudioContext, out: AudioNode, time: number, level: 0 | 1 | 2) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = [1760, 1175, 880][level];
  const peak = [0.9, 0.55, 0.22][level];
  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(peak, time + 0.002);
  env.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
  osc.connect(env).connect(out);
  osc.start(time);
  osc.stop(time + 0.06);
}

export interface PlayOptions {
  /** one repeat, padded to whole bars; null = rest */
  slots: (FretNote | null)[];
  subdivision: Subdivision;
  bpm: number;
  /** 0 = endless */
  repeats: number;
  countIn: boolean;
  /** arpeggios ring until the same string is played again; scales are played legato */
  ring: boolean;
  onEnd: () => void;
}

const LOOKAHEAD = 0.15; // seconds scheduled ahead
const TICK_MS = 25;

/**
 * Plays an exercise on the Web Audio clock: notes and metronome are scheduled a
 * little ahead with exact times, never with setTimeout, so sound, clicks and the
 * highlighted note stay in sync. `position()` tells the UI which slot sounds now.
 */
export class PracticeEngine {
  private ctx: AudioContext | null = null;
  private guitarBus: GainNode | null = null;
  private clickBus: GainNode | null = null;
  private guitar: KarplusStrongGuitar | null = null;
  private timer = 0;
  private endTimer = 0;
  private run: {
    opts: PlayOptions;
    t0: number;
    step: number;
    next: number;
    total: number;
    voices: (Voice | null)[];
  } | null = null;

  private guitarVolume = 0.8;
  private clickVolume = 0.6;
  private guitarOn = true;
  private latencyOverride: number | null = null;

  /** Measured output latency in seconds, or null to use the browser's estimate. */
  setLatency(seconds: number | null) {
    this.latencyOverride = seconds;
  }

  private ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      this.guitarBus = this.ctx.createGain();
      this.clickBus = this.ctx.createGain();
      this.guitarBus.connect(this.ctx.destination);
      this.clickBus.connect(this.ctx.destination);
      this.guitar = new KarplusStrongGuitar(this.ctx, this.guitarBus);
      this.applyVolumes();
    }
    return this.ctx;
  }

  private applyVolumes() {
    if (this.guitarBus) this.guitarBus.gain.value = this.guitarOn ? this.guitarVolume : 0;
    if (this.clickBus) this.clickBus.gain.value = this.clickVolume;
  }

  setGuitarVolume(v: number) {
    this.guitarVolume = v;
    this.applyVolumes();
  }
  setClickVolume(v: number) {
    this.clickVolume = v;
    this.applyVolumes();
  }
  setGuitarOn(on: boolean) {
    this.guitarOn = on;
    this.applyVolumes();
  }

  get playing() {
    return this.run !== null;
  }

  async start(opts: PlayOptions) {
    this.stop();
    const ctx = this.ensure();
    if (ctx.state !== 'running') await ctx.resume();
    this.guitar!.prepare(new Set(opts.slots.filter((s) => s !== null).map((s) => s!.midi)));

    const beat = 60 / opts.bpm;
    const step = beat / opts.subdivision;
    const lead = 0.08;
    const countInTime = opts.countIn ? BEATS_PER_BAR * beat : 0;
    const t0 = ctx.currentTime + lead + countInTime;
    if (opts.countIn) {
      for (let b = 0; b < BEATS_PER_BAR; b++) {
        click(ctx, this.clickBus!, t0 - countInTime + b * beat, b === 0 ? 0 : 1);
      }
    }
    const total = opts.repeats > 0 ? opts.repeats * opts.slots.length : Infinity;
    this.run = { opts, t0, step, next: 0, total, voices: Array(6).fill(null) };
    this.tick();
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  private tick() {
    const ctx = this.ctx;
    const r = this.run;
    if (!ctx || !r) return;
    const { opts, step } = r;
    const len = opts.slots.length;
    while (r.next < r.total && r.t0 + r.next * step < ctx.currentTime + LOOKAHEAD) {
      const time = r.t0 + r.next * step;
      const inPass = r.next % len;
      // metronome on every subdivision: bar, beat, in between
      const perBar = BEATS_PER_BAR * opts.subdivision;
      const level = inPass % perBar === 0 ? 0 : inPass % opts.subdivision === 0 ? 1 : 2;
      click(ctx, this.clickBus!, time, level);

      const note = opts.slots[inPass];
      if (note) {
        // a new note on a string cuts the one still ringing there
        r.voices[note.string]?.release(time);
        r.voices[note.string] = this.guitar!.play(
          note.midi,
          note.string,
          time,
          opts.ring ? null : step * 0.96,
        );
      }
      r.next += 1;
    }
    if (r.next >= r.total && !this.endTimer) {
      const endAt = r.t0 + r.total * step;
      this.endTimer = window.setTimeout(
        () => {
          const done = this.run?.opts.onEnd;
          this.stop();
          done?.();
        },
        Math.max(0, (endAt - ctx.currentTime) * 1000) + 50,
      );
    }
  }

  stop() {
    window.clearInterval(this.timer);
    window.clearTimeout(this.endTimer);
    this.timer = 0;
    this.endTimer = 0;
    if (this.ctx && this.run) {
      const now = this.ctx.currentTime;
      for (const v of this.run.voices) v?.release(now);
    }
    this.run = null;
  }

  /**
   * Slot that is sounding now (output latency taken into account), or null when
   * stopped. `countIn` is true during the count-in bar.
   */
  position(): { slot: number; countIn: boolean } | null {
    const ctx = this.ctx;
    const r = this.run;
    if (!ctx || !r) return null;
    // a measured calibration wins over what the browser reports (often too low on Bluetooth)
    const latency =
      this.latencyOverride ?? (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    const now = ctx.currentTime - latency;
    if (now < r.t0) return { slot: -1, countIn: true };
    const k = Math.floor((now - r.t0) / r.step);
    if (k >= r.total) return null;
    return { slot: k % r.opts.slots.length, countIn: false };
  }

  dispose() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}
