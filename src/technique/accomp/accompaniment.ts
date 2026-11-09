import type { Chord } from '../chords';
import { DrumKit, Drone, Sampler, type SampleSet } from './instruments';
import { generateBar, newStyleState, type StyleId, type StyleState } from './styles';

export type PartId = 'bass' | 'piano' | 'drums' | 'drone';

export interface PartSettings {
  on: boolean;
  volume: number;
}

export interface AccompConfig {
  on: boolean;
  style: StyleId;
  /** the vamp: one chord per bar, repeating */
  chords: Chord[];
  pianoSound: Extract<SampleSet, 'acoustic_grand_piano' | 'electric_piano_1'>;
  /** MIDI note of the drone's root */
  droneRoot: number;
  parts: Record<PartId, PartSettings>;
}

/** Balance, measured on rendered bars: the samples are quiet, the synthesised kick is not. */
const PART_GAIN: Record<PartId, number> = { bass: 3.2, piano: 3.4, drums: 0.8, drone: 0.6 };

/**
 * The combo: bass, piano, drums and a drone, scheduled bar by bar on the same
 * clock as the exercise. Changes to the config apply from the next bar.
 */
export class Accompaniment {
  private ctx: BaseAudioContext;
  private gains: Record<PartId, GainNode>;
  private bass: Sampler;
  private pianos: Record<AccompConfig['pianoSound'], Sampler>;
  private drums: DrumKit;
  private drone: Drone;
  private state: StyleState = newStyleState();
  config: AccompConfig;

  constructor(ctx: BaseAudioContext, out: AudioNode, config: AccompConfig) {
    this.ctx = ctx;
    this.config = config;
    const gain = () => {
      const g = ctx.createGain();
      g.connect(out);
      return g;
    };
    this.gains = { bass: gain(), piano: gain(), drums: gain(), drone: gain() };
    this.bass = new Sampler(ctx, this.gains.bass, 'acoustic_bass');
    this.pianos = {
      acoustic_grand_piano: new Sampler(ctx, this.gains.piano, 'acoustic_grand_piano'),
      electric_piano_1: new Sampler(ctx, this.gains.piano, 'electric_piano_1'),
    };
    this.drums = new DrumKit(ctx, this.gains.drums);
    this.drone = new Drone(ctx, this.gains.drone);
    this.applyVolumes();
  }

  setConfig(config: AccompConfig) {
    this.config = config;
    this.applyVolumes();
  }

  private applyVolumes() {
    for (const p of Object.keys(this.gains) as PartId[]) {
      const s = this.config.parts[p];
      this.gains[p].gain.value = s.on ? s.volume * PART_GAIN[p] : 0;
    }
  }

  /** Load the samples the current config needs. */
  load() {
    return Promise.all([this.bass.load(), this.pianos[this.config.pianoSound].load()]);
  }

  /** Start fresh (e.g. on play): the walking line and voicings begin anew. */
  reset() {
    this.state = newStyleState();
  }

  /** Schedule bar `bar` starting at `time`. */
  scheduleBar(bar: number, time: number, beatSeconds: number, bpm: number) {
    const c = this.config;
    if (!c.on) return;
    const at = (beat: number) => time + beat * beatSeconds;
    if (c.parts.drone.on) this.drone.play(c.droneRoot, time, beatSeconds * 4);
    if (c.chords.length === 0) return;
    const chord = c.chords[((bar % c.chords.length) + c.chords.length) % c.chords.length];
    const next = c.chords[(((bar + 1) % c.chords.length) + c.chords.length) % c.chords.length];
    const piano = this.pianos[c.pianoSound];
    for (const e of generateBar(c.style, chord, next, bar, bpm, this.state)) {
      if (e.part === 'bass' && c.parts.bass.on) this.bass.play(e.midi, at(e.beat), e.dur * beatSeconds, e.vel);
      if (e.part === 'piano' && c.parts.piano.on) {
        for (const m of e.midis) piano.play(m, at(e.beat), e.dur * beatSeconds, e.vel);
      }
      if (e.part === 'drums' && c.parts.drums.on) this.drums.play(e.sound, at(e.beat), e.vel);
    }
  }

  get context() {
    return this.ctx;
  }
}
