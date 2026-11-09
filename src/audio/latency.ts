import { useCallback, useEffect, useState } from 'react';

/**
 * Output latency as the player actually hears it: how much later a sound comes
 * out of the speaker or headphones than the moment it was scheduled for.
 * Browsers report `outputLatency`, but Bluetooth is often under-reported, so the
 * user can measure it by tapping along (see LatencyTest).
 */
export interface LatencyCalibration {
  ms: number;
  /** half the interquartile range of the taps, a rough confidence */
  spreadMs: number;
  measuredAt: string;
}

const KEY = 'gsm.latency';

function load(): LatencyCalibration | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as LatencyCalibration;
    return typeof v?.ms === 'number' && Number.isFinite(v.ms) ? v : null;
  } catch {
    return null;
  }
}

/** The stored calibration, plus a flag when an audio device came or went since. */
export function useLatencyCalibration() {
  const [calibration, setCalibration] = useState<LatencyCalibration | null>(load);
  const [deviceChanged, setDeviceChanged] = useState(false);

  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onChange = () => setDeviceChanged(true);
    md.addEventListener('devicechange', onChange);
    return () => md.removeEventListener('devicechange', onChange);
  }, []);

  const save = useCallback((c: LatencyCalibration | null) => {
    setCalibration(c);
    setDeviceChanged(false);
    try {
      if (c) window.localStorage.setItem(KEY, JSON.stringify(c));
      else window.localStorage.removeItem(KEY);
    } catch {
      // kept for this visit only
    }
  }, []);

  const dismiss = useCallback(() => setDeviceChanged(false), []);

  return { calibration, deviceChanged, save, dismiss };
}

export type LatencyState = ReturnType<typeof useLatencyCalibration>;

const BPM = 90;
const COUNT_IN = 4;
const CLICKS = 16;

export interface LatencyResult {
  ms: number;
  spreadMs: number;
  taps: number;
}

/**
 * Tap-along test: four count-in clicks, then sixteen clicks to tap on. Each tap is
 * placed on the audio clock and compared with the click it belongs to; the median
 * difference is the latency as heard (plus the tapper's own habit, which is small
 * and fairly constant).
 */
export class LatencyTest {
  private ctx: AudioContext | null = null;
  private clicks: number[] = [];
  private deltas: number[] = [];
  private endTimer = 0;

  readonly beat = 60 / BPM;
  readonly total = CLICKS;

  async start(onEnd: () => void) {
    this.stop();
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    if (ctx.state !== 'running') await ctx.resume();
    const t0 = ctx.currentTime + 0.3;
    this.clicks = [];
    this.deltas = [];
    for (let i = 0; i < COUNT_IN + CLICKS; i++) {
      const t = t0 + i * this.beat;
      this.click(t, i < COUNT_IN ? (i === 0 ? 0 : 1) : (i - COUNT_IN) % 4 === 0 ? 0 : 1);
      if (i >= COUNT_IN) this.clicks.push(t);
    }
    const end = t0 + (COUNT_IN + CLICKS) * this.beat + 0.4;
    this.endTimer = window.setTimeout(onEnd, (end - ctx.currentTime) * 1000);
  }

  private click(time: number, level: 0 | 1) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = level === 0 ? 1760 : 1175;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(level === 0 ? 0.9 : 0.6, time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(env).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  /** Index of the test click that is sounding (or about to), for the progress dots. */
  progress(): number {
    if (!this.ctx || this.clicks.length === 0) return -1;
    const now = this.ctx.currentTime;
    return Math.max(-1, Math.floor((now - this.clicks[0]) / this.beat));
  }

  /** Register a tap; `eventTimeStamp` is the DOM event's timeStamp (performance clock). */
  tap(eventTimeStamp: number) {
    const ctx = this.ctx;
    if (!ctx || this.clicks.length === 0) return;
    const at = ctx.currentTime + (eventTimeStamp - performance.now()) / 1000;
    let best = Infinity;
    for (const c of this.clicks) {
      const d = at - c;
      if (Math.abs(d - 0.1) < Math.abs(best - 0.1)) best = d; // most latencies are 0–0.3 s
    }
    if (best > -0.15 && best < 0.5) this.deltas.push(best);
  }

  result(): LatencyResult | null {
    const d = [...this.deltas].sort((a, b) => a - b);
    if (d.length < 8) return null;
    const q = (p: number) => d[Math.min(d.length - 1, Math.floor(p * d.length))];
    const median = q(0.5);
    return {
      ms: Math.round(Math.max(0, median) * 1000),
      spreadMs: Math.round(((q(0.75) - q(0.25)) / 2) * 1000),
      taps: d.length,
    };
  }

  stop() {
    window.clearTimeout(this.endTimer);
    void this.ctx?.close();
    this.ctx = null;
  }
}
