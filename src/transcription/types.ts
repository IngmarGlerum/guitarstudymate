/** One detected note on the shared time axis (seconds). */
export interface NoteEvent {
  start: number;
  duration: number;
  /** MIDI note number, 60 = C4 */
  midi: number;
  /** model confidence/energy, 0..1 */
  amplitude: number;
}

/** The JSON document we store and export. */
export interface NoteDocument {
  version: 1;
  source: { name: string; duration: number };
  engine: 'basic-pitch';
  notes: NoteEvent[];
}

export type WorkerRequest = {
  type: 'run';
  /** mono audio at TRANSCRIBE_RATE */
  samples: Float32Array;
  modelUrl: string;
  /** force a backend, used after the GPU path timed out */
  backend?: 'webgl' | 'cpu';
};

export type WorkerResponse =
  | { type: 'stage'; stage: 'model' | 'analyse' | 'notes'; backend?: string }
  | { type: 'progress'; value: number }
  | { type: 'done'; notes: NoteEvent[] }
  | { type: 'error'; message: string };

/** Basic Pitch is trained on 22.05 kHz mono. */
export const TRANSCRIBE_RATE = 22050;
