/**
 * Accompaniment instruments. Bass and piano play FluidR3_GM samples (CC BY 3.0,
 * see public/sounds/fluidr3/LICENSE.txt); only every third semitone is stored and
 * the rest is played by resampling. Drums and drone are synthesised.
 */

export type SampleSet = 'acoustic_bass' | 'acoustic_grand_piano' | 'electric_piano_1';

const SAMPLE_RANGE: Record<SampleSet, [number, number]> = {
  acoustic_bass: [28, 58],
  acoustic_grand_piano: [43, 82],
  electric_piano_1: [43, 82],
};

/** the MP3 encoder adds a few ms of silence before the attack */
const ENCODER_DELAY = 0.004;

export class Sampler {
  private buffers = new Map<number, AudioBuffer>();
  private loading: Promise<void> | null = null;
  readonly set: SampleSet;
  private ctx: BaseAudioContext;
  private out: AudioNode;

  constructor(ctx: BaseAudioContext, out: AudioNode, set: SampleSet) {
    this.ctx = ctx;
    this.out = out;
    this.set = set;
  }

  /** Fetch and decode the samples once; resolves when they are ready. */
  load(): Promise<void> {
    if (this.loading) return this.loading;
    const [lo, hi] = SAMPLE_RANGE[this.set];
    const base = `${import.meta.env.BASE_URL}sounds/fluidr3/${this.set}/`;
    const jobs: Promise<void>[] = [];
    for (let m = lo; m <= hi; m += 3) {
      jobs.push(
        fetch(`${base}${m}.mp3`)
          .then((r) => r.arrayBuffer())
          .then((data) => this.ctx.decodeAudioData(data))
          .then((buf) => {
            this.buffers.set(m, buf);
          }),
      );
    }
    this.loading = Promise.all(jobs).then(() => undefined);
    return this.loading;
  }

  get ready() {
    return this.buffers.size > 0;
  }

  play(midi: number, time: number, duration: number, velocity: number) {
    if (!this.buffers.size) return;
    let nearest = -1;
    for (const m of this.buffers.keys()) {
      if (nearest < 0 || Math.abs(m - midi) < Math.abs(nearest - midi)) nearest = m;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.get(nearest)!;
    src.playbackRate.value = 2 ** ((midi - nearest) / 12);
    const env = this.ctx.createGain();
    const peak = 0.15 + 0.85 * velocity;
    env.gain.setValueAtTime(peak, time);
    const end = time + Math.max(0.05, duration);
    env.gain.setTargetAtTime(0, end, 0.06);
    src.connect(env).connect(this.out);
    src.start(time, ENCODER_DELAY);
    src.stop(end + 0.5);
  }
}

export type DrumSound = 'kick' | 'snare' | 'rim' | 'hatClosed' | 'hatFoot' | 'ride' | 'brush';

/** A small synthesised kit: no samples needed, light enough for every style. */
export class DrumKit {
  private noise: AudioBuffer;
  private ctx: BaseAudioContext;
  private out: AudioNode;

  constructor(ctx: BaseAudioContext, out: AudioNode) {
    this.ctx = ctx;
    this.out = out;
    const len = Math.floor(ctx.sampleRate * 1.5);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  private noiseBurst(time: number, opts: { type: BiquadFilterType; freq: number; q?: number; decay: number; gain: number }) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = opts.type;
    filter.frequency.value = opts.freq;
    filter.Q.value = opts.q ?? 0.7;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(opts.gain, time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0008, time + opts.decay);
    src.connect(filter).connect(env).connect(this.out);
    src.start(time, Math.random() * 0.5);
    src.stop(time + opts.decay + 0.05);
  }

  private tone(time: number, opts: { type: OscillatorType; from: number; to: number; sweep: number; decay: number; gain: number }) {
    const osc = this.ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.from, time);
    osc.frequency.exponentialRampToValueAtTime(opts.to, time + opts.sweep);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(opts.gain, time + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0008, time + opts.decay);
    osc.connect(env).connect(this.out);
    osc.start(time);
    osc.stop(time + opts.decay + 0.05);
  }

  play(sound: DrumSound, time: number, velocity: number) {
    const v = 0.2 + 0.8 * velocity;
    switch (sound) {
      case 'kick':
        this.tone(time, { type: 'sine', from: 120, to: 45, sweep: 0.12, decay: 0.32, gain: 0.45 * v });
        break;
      case 'snare':
        this.noiseBurst(time, { type: 'bandpass', freq: 1800, q: 0.8, decay: 0.18, gain: 0.4 * v });
        this.tone(time, { type: 'triangle', from: 220, to: 160, sweep: 0.05, decay: 0.09, gain: 0.25 * v });
        break;
      case 'brush':
        this.noiseBurst(time, { type: 'bandpass', freq: 3000, q: 0.5, decay: 0.22, gain: 0.18 * v });
        break;
      case 'rim':
        this.tone(time, { type: 'square', from: 1700, to: 1600, sweep: 0.01, decay: 0.035, gain: 0.22 * v });
        this.noiseBurst(time, { type: 'bandpass', freq: 2500, q: 2, decay: 0.03, gain: 0.25 * v });
        break;
      case 'hatClosed':
        this.noiseBurst(time, { type: 'highpass', freq: 7500, decay: 0.045, gain: 0.22 * v });
        break;
      case 'hatFoot':
        this.noiseBurst(time, { type: 'highpass', freq: 6500, decay: 0.06, gain: 0.22 * v });
        break;
      case 'ride': {
        this.noiseBurst(time, { type: 'highpass', freq: 5500, decay: 0.55, gain: 0.32 * v });
        // a little bell: two inharmonic partials
        for (const f of [3020, 4270]) {
          this.tone(time, { type: 'sine', from: f, to: f * 0.995, sweep: 0.5, decay: 0.45, gain: 0.06 * v });
        }
        break;
      }
    }
  }
}

/** A soft pad on the root and fifth, for modal practice over a drone. */
export class Drone {
  private ctx: BaseAudioContext;
  private out: AudioNode;
  constructor(ctx: BaseAudioContext, out: AudioNode) {
    this.ctx = ctx;
    this.out = out;
  }

  /** One sustained segment; consecutive segments overlap so the drone never breaks. */
  play(rootMidi: number, time: number, duration: number) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.16, time + 0.25);
    env.gain.setValueAtTime(0.16, time + duration);
    env.gain.linearRampToValueAtTime(0, time + duration + 0.3);
    filter.connect(env).connect(this.out);
    for (const [semi, detune] of [
      [0, -6],
      [0, 6],
      [7, 0],
      [12, 3],
    ]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 440 * 2 ** ((rootMidi + semi - 69) / 12);
      osc.detune.value = detune;
      const g = this.ctx.createGain();
      g.gain.value = semi === 12 ? 0.25 : 0.4;
      osc.connect(g).connect(filter);
      osc.start(time);
      osc.stop(time + duration + 0.35);
    }
  }
}
