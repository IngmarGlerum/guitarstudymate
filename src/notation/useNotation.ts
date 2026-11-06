import { useCallback, useMemo, useRef, useState } from 'react';
import type { NoteEvent } from '../transcription/types';
import { quantize, type Bar } from './quantize';
import { BPM_MAX, BPM_MIN, createTapper, type Tempo } from './tempo';

/**
 * Notes weaker than this are left out of the notation (they stay visible, dimmed,
 * in the piano roll). Basic Pitch reports overtones as separate, weaker notes, but
 * played notes can be just as weak: on our two synthetic test files ghosts reached
 * 0.36 and one played note was 0.36. No value separates them, so the user can change it.
 */
export const DEFAULT_MIN_STRENGTH = 0.35;

export interface NotationSettings {
  bpm: number | null;
  beatsPerBar: number;
  /** null = the first kept note's onset */
  downbeat: number | null;
  minStrength: number;
}

const INITIAL: NotationSettings = {
  bpm: null,
  beatsPerBar: 4,
  downbeat: null,
  minStrength: DEFAULT_MIN_STRENGTH,
};

export function useNotation(notes: NoteEvent[] | null) {
  const [settings, setSettings] = useState<NotationSettings>(INITIAL);
  const tapper = useRef(createTapper());

  const kept = useMemo(
    () => (notes ?? []).filter((n) => n.amplitude >= settings.minStrength),
    [notes, settings.minStrength],
  );

  const tempo = useMemo<(Tempo & { bpm: number }) | null>(() => {
    if (settings.bpm === null) return null;
    return {
      bpm: settings.bpm,
      beatsPerBar: settings.beatsPerBar,
      downbeat: settings.downbeat ?? kept[0]?.start ?? 0,
    };
  }, [settings.bpm, settings.beatsPerBar, settings.downbeat, kept]);

  const bars = useMemo(() => {
    const map = new Map<number, Bar>();
    if (tempo) for (const bar of quantize(kept, tempo)) map.set(bar.index, bar);
    return map;
  }, [kept, tempo]);

  const setBpm = useCallback((bpm: number | null) => {
    setSettings((s) => ({
      ...s,
      bpm: bpm === null || !Number.isFinite(bpm) ? null : Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm))),
    }));
  }, []);

  const tap = useCallback(() => {
    const bpm = tapper.current(performance.now() / 1000);
    if (bpm !== null && bpm >= BPM_MIN && bpm <= BPM_MAX) setSettings((s) => ({ ...s, bpm }));
    return bpm;
  }, []);

  const setBeatsPerBar = useCallback(
    (beatsPerBar: number) => setSettings((s) => ({ ...s, beatsPerBar })),
    [],
  );
  const setDownbeat = useCallback(
    (downbeat: number | null) => setSettings((s) => ({ ...s, downbeat })),
    [],
  );
  const setMinStrength = useCallback(
    (minStrength: number) => setSettings((s) => ({ ...s, minStrength })),
    [],
  );
  const reset = useCallback(() => {
    tapper.current = createTapper();
    setSettings(INITIAL);
  }, []);

  return {
    settings,
    tempo,
    bars,
    keptCount: kept.length,
    setBpm,
    tap,
    setBeatsPerBar,
    setDownbeat,
    setMinStrength,
    reset,
  };
}

export type Notation = ReturnType<typeof useNotation>;
