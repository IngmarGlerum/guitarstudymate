/// <reference lib="webworker" />
import * as tf from '@tensorflow/tfjs';
import { BasicPitch, noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch';
import type { NoteEvent, WorkerRequest, WorkerResponse } from './types';

/**
 * Basic Pitch decoding settings, tuned for guitar. The Python defaults are
 * onset 0.5, frame 0.3, minimum length ~128 ms (11 frames); we keep shorter notes
 * so fast lines survive.
 */
const ONSET_THRESHOLD = 0.5;
const FRAME_THRESHOLD = 0.3;
const MIN_NOTE_FRAMES = 6; // ≈ 70 ms at 86 frames/s
const MIN_FREQ_HZ = 70; // just under drop-D (D2, 73 Hz)
const MAX_FREQ_HZ = 1400; // just over E6, fret 24 on the high E string

const post = (message: WorkerResponse) => self.postMessage(message);

// tfjs 3.x's browser platform checks `!window` before scheduling GPU fence polls,
// which throws in a worker and silently stalls WebGL inference. Plain setTimeout is
// what it falls back to on the main thread anyway (USE_SETTIMEOUTCUSTOM is off).
const platform = tf.env().platform as { setTimeoutCustom?: (fn: () => void, delay: number) => void };
platform.setTimeoutCustom = (fn, delay) => {
  setTimeout(fn, delay);
};

async function pickBackend(forced?: string): Promise<string> {
  // WebGL in a worker needs OffscreenCanvas; fall back to the (slow) CPU backend.
  for (const name of forced ? [forced] : ['webgl', 'cpu']) {
    try {
      if (await tf.setBackend(name)) {
        await tf.ready();
        return name;
      }
    } catch {
      // try the next backend
    }
  }
  throw new Error('no TensorFlow.js backend available');
}

let model: Promise<tf.GraphModel> | null = null;

async function run({ samples, modelUrl, backend: forced }: WorkerRequest) {
  post({ type: 'stage', stage: 'model' });
  const backend = await pickBackend(forced);
  model ??= tf.loadGraphModel(modelUrl);
  const basicPitch = new BasicPitch(model);
  await model;

  post({ type: 'stage', stage: 'analyse', backend });
  // Only frames and onsets are kept; contours (pitch bends) would cost
  // ~3× the memory and are not used yet.
  const frames: number[][] = [];
  const onsets: number[][] = [];
  let last = -1;
  await basicPitch.evaluateModel(
    samples,
    (f, o) => {
      for (const row of f) frames.push(row);
      for (const row of o) onsets.push(row);
    },
    (p) => {
      const value = Math.floor(p * 100);
      if (value !== last) {
        last = value;
        post({ type: 'progress', value: p });
      }
    },
  );

  post({ type: 'stage', stage: 'notes' });
  const notes: NoteEvent[] =
    frames.length === 0
      ? []
      : noteFramesToTime(
          outputToNotesPoly(
            frames,
            onsets,
            ONSET_THRESHOLD,
            FRAME_THRESHOLD,
            MIN_NOTE_FRAMES,
            true,
            MAX_FREQ_HZ,
            MIN_FREQ_HZ,
            true,
          ),
        )
          .map((n) => ({
            start: Math.max(0, n.startTimeSeconds),
            duration: n.durationSeconds,
            midi: n.pitchMidi,
            amplitude: n.amplitude,
          }))
          .sort((a, b) => a.start - b.start || a.midi - b.midi);

  post({ type: 'done', notes });
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  if (e.data.type !== 'run') return;
  run(e.data).catch((err: unknown) => {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  });
};
