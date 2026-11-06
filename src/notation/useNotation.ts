import { useCallback, useMemo, useRef, useState } from 'react';
import { applyGate } from '../transcription/gate';
import type { Envelope, NoteEvent } from '../transcription/types';
import { quantize, type Bar } from './quantize';
import { BPM_MAX, BPM_MIN, createTapper, type Tempo } from './tempo';

/**
 * Notes weaker than this are left out of the notation (they stay visible, dimmed,
 * in the piano roll). Basic Pitch reports overtones as separate, weaker notes, but
 * played notes can be just as weak: on our two synthetic test files ghosts reached
 * 0.36 and one played note was 0.36. No value separates them, so the user can change it.
 */
export const DEFAULT_MIN_STRENGTH = 0.35;

/**
 * Silence gate, relative to the loudest moment. On the owner's dry riff recording
 * playing sat between −1 and −13 dB and the echo in the rests at −25 to −31 dB.
 */
export const DEFAULT_GATE_DB = -20;
export const GATE_MIN_DB = -45;
export const GATE_MAX_DB = -8;

export interface NotationSettings {
  bpm: number | null;
  beatsPerBar: number;
  /** null = the first kept note's onset */
  downbeat: number | null;
  minStrength: number;
  gateDb: number;
}

const INITIAL: NotationSettings = {
  bpm: null,
  beatsPerBar: 4,
  downbeat: null,
  minStrength: DEFAULT_MIN_STRENGTH,
  gateDb: DEFAULT_GATE_DB,
};

export function useNotation(notes: NoteEvent[] | null, envelope: Envelope | null) {
  const [settings, setSettings] = useState<NotationSettings>(INITIAL);
  const tapper = useRef(createTapper());

  // every note, shortened by the silence gate, with `muted` for the filtered ones
  const display = useMemo(
    () => applyGate(notes ?? [], envelope, settings.gateDb, settings.minStrength),
    [notes, envelope, settings.gateDb, settings.minStrength],
  );
  const kept = useMemo(() => display.filter((n) => !n.muted), [display]);

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
  const setGateDb = useCallback(
    (gateDb: number) => setSettings((s) => ({ ...s, gateDb })),
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
    display,
    kept,
    keptCount: kept.length,
    setGateDb,
    setBpm,
    tap,
    setBeatsPerBar,
    setDownbeat,
    setMinStrength,
    reset,
  };
}

export type Notation = ReturnType<typeof useNotation>;
