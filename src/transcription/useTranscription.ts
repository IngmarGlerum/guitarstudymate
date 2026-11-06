import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeForTranscription } from './resample';
import type { NoteEvent, WorkerRequest, WorkerResponse } from './types';

export type TranscriptionStatus =
  | 'idle'
  | 'decoding'
  | 'model'
  | 'analyse'
  | 'notes'
  | 'done'
  | 'error';

export const TRANSCRIPTION_MESSAGES = {
  failed: 'Het herkennen van de noten is mislukt. Probeer het opnieuw.',
  decode: 'De opname kon niet opnieuw worden ingelezen voor de notenherkenning.',
} as const;

/**
 * If the GPU has not finished the first 2-second window by then, assume WebGL is
 * stuck or unusably slow (seen with software GL) and start over on the CPU.
 * The first window includes shader compilation, so this is generous.
 */
const GPU_WATCHDOG_MS = 30_000;

function modelUrl() {
  return new URL(`${import.meta.env.BASE_URL}models/basic-pitch/model.json`, window.location.href)
    .href;
}

/**
 * Runs Basic Pitch in a worker. Starting again, loading another file (via reset)
 * or unmounting terminates the worker, so a stale run never reports back.
 */
export function useTranscription() {
  const [status, setStatus] = useState<TranscriptionStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [notes, setNotes] = useState<NoteEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backend, setBackend] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const watchdog = useRef(0);
  const token = useRef(0);

  const stop = useCallback(() => {
    token.current += 1;
    window.clearTimeout(watchdog.current);
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const fail = useCallback(
    (message: string) => {
      stop();
      setStatus('error');
      setError(message);
    },
    [stop],
  );

  const launch = useCallback(
    function launch(run: number, samples: Float32Array, forced?: 'cpu') {
      // The samples are transferred to the worker; keep a copy for a CPU retry.
      const retryCopy = forced ? null : samples.slice();
      const worker = new Worker(new URL('./basicPitch.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = worker;
      let progressMessages = 0;

      const armWatchdog = () => {
        window.clearTimeout(watchdog.current);
        watchdog.current = window.setTimeout(() => {
          if (run !== token.current || !retryCopy) return;
          console.warn('transcription: WebGL too slow or stuck, retrying on the CPU');
          worker.terminate();
          launch(run, retryCopy, 'cpu');
        }, GPU_WATCHDOG_MS);
      };

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        if (run !== token.current) return;
        const msg = e.data;
        switch (msg.type) {
          case 'stage':
            setStatus(msg.stage);
            if (msg.backend) setBackend(msg.backend);
            if (msg.stage === 'analyse' && msg.backend === 'webgl' && retryCopy) armWatchdog();
            if (msg.stage === 'notes') window.clearTimeout(watchdog.current);
            break;
          case 'progress':
            // the first message comes before window 0, the second after it
            if (++progressMessages === 2) window.clearTimeout(watchdog.current);
            setProgress(msg.value);
            break;
          case 'done':
            stop();
            setNotes(msg.notes);
            setProgress(1);
            setStatus('done');
            break;
          case 'error':
            console.error('transcription failed:', msg.message);
            fail(TRANSCRIPTION_MESSAGES.failed);
            break;
        }
      };
      worker.onerror = (e) => {
        if (run !== token.current) return;
        console.error('transcription worker error:', e.message);
        fail(TRANSCRIPTION_MESSAGES.failed);
      };

      const request: WorkerRequest = { type: 'run', samples, modelUrl: modelUrl(), backend: forced };
      worker.postMessage(request, [samples.buffer]);
    },
    [stop, fail],
  );

  const reset = useCallback(() => {
    stop();
    setStatus('idle');
    setProgress(0);
    setNotes(null);
    setError(null);
  }, [stop]);

  const start = useCallback(
    async (file: File) => {
      stop();
      const run = token.current;
      setStatus('decoding');
      setProgress(0);
      setNotes(null);
      setError(null);
      setBackend(null);

      let samples: Float32Array;
      try {
        samples = await decodeForTranscription(file);
      } catch {
        if (run === token.current) fail(TRANSCRIPTION_MESSAGES.decode);
        return;
      }
      if (run === token.current) launch(run, samples);
    },
    [stop, fail, launch],
  );

  const busy = status !== 'idle' && status !== 'done' && status !== 'error';

  return { status, progress, notes, error, backend, busy, start, cancel: reset, reset };
}

export type Transcription = ReturnType<typeof useTranscription>;
