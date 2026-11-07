import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp } from '../lib/format';
import { decodeFile, waitForMetadata } from './decode';
import { computePeaks, type Peaks } from './peaks';

export type LoopRegion = { start: number; end: number };
export type LoadStatus = 'empty' | 'loading' | 'ready' | 'error';

export interface TrackInfo {
  name: string;
  size: number;
  channels: number;
  duration: number;
}

export const MIN_LOOP = 0.05;
export const MAX_DURATION_S = 15 * 60;
export const RATE_MIN = 0.25;
export const RATE_MAX = 2;

export const MESSAGES = {
  unsupported:
    'Dit bestand kan niet worden ingelezen. Probeer een WAV-, MP3-, M4A-, OGG- of FLAC-bestand.',
  notAudio: 'Dat is geen audiobestand. Kies een WAV-, MP3-, M4A-, OGG- of FLAC-bestand.',
  tooLong: 'Deze opname duurt langer dan 15 minuten. Knip er een fragment uit en probeer het opnieuw.',
} as const;

type PitchAudio = HTMLAudioElement & { webkitPreservesPitch?: boolean };

function keepPitch(audio: HTMLAudioElement) {
  audio.preservesPitch = true;
  (audio as PitchAudio).webkitPreservesPitch = true;
}

export function useAudioTransport() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const loadToken = useRef(0);

  const [status, setStatus] = useState<LoadStatus>('empty');
  const [error, setError] = useState<string | null>(null);
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [peaks, setPeaks] = useState<Peaks | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const [volume, setVolumeState] = useState(0.9);
  const [loop, setLoopState] = useState<LoopRegion | null>(null);
  const [loopEnabled, setLoopEnabledState] = useState(false);

  // Mirrors for event handlers and the frame loop, which must not wait for a render.
  const loopRef = useRef<LoopRegion | null>(null);
  const loopEnabledRef = useRef(false);
  const durationRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rateRef = useRef(1);
  /** setting: after stopping, jump back to where playback started */
  const returnOnStopRef = useRef(false);
  const playStartRef = useRef(0);
  const volumeRef = useRef(0.9);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      keepPitch(audio);
      audio.volume = volumeRef.current;
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const getTime = useCallback(() => audioRef.current?.currentTime ?? 0, []);

  /** Wrap playback back to the loop start when it crosses the loop end. */
  const checkLoop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = audio.currentTime;
    const region = loopRef.current;
    if (
      loopEnabledRef.current &&
      region &&
      !audio.paused &&
      lastTimeRef.current < region.end &&
      t >= region.end
    ) {
      audio.currentTime = region.start;
      lastTimeRef.current = region.start;
      return;
    }
    lastTimeRef.current = t;
  }, []);

  useEffect(() => {
    const audio = getAudio();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      const region = loopRef.current;
      if (loopEnabledRef.current && region) {
        audio.currentTime = region.start;
        lastTimeRef.current = region.start;
        void audio.play().catch(() => {});
      } else if (returnOnStopRef.current) {
        audio.currentTime = playStartRef.current;
        lastTimeRef.current = playStartRef.current;
      }
    };
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', checkLoop); // fallback when the tab is in the background
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', checkLoop);
      audio.pause();
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [getAudio, checkLoop]);

  // Frame-accurate loop check while playing.
  useEffect(() => {
    if (!isPlaying) return;
    let id = 0;
    const tick = () => {
      checkLoop();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [isPlaying, checkLoop]);

  const setLoop = useCallback((region: LoopRegion | null, enable?: boolean) => {
    const duration = durationRef.current;
    let next: LoopRegion | null = null;
    if (region && duration > 0) {
      let start = clamp(Math.min(region.start, region.end), 0, duration);
      let end = clamp(Math.max(region.start, region.end), 0, duration);
      if (end - start < MIN_LOOP) {
        if (start + MIN_LOOP <= duration) {
          end = start + MIN_LOOP;
        } else {
          end = duration;
          start = Math.max(0, duration - MIN_LOOP);
        }
      }
      next = { start, end };
    }
    loopRef.current = next;
    setLoopState(next);

    let enabled = loopEnabledRef.current;
    if (!next) enabled = false;
    else if (enable !== undefined) enabled = enable;
    loopEnabledRef.current = enabled;
    setLoopEnabledState(enabled);
  }, []);

  const setLoopEnabled = useCallback(
    (on: boolean) => {
      if (on && !loopRef.current) {
        if (durationRef.current > 0) setLoop({ start: 0, end: durationRef.current }, true);
        return;
      }
      loopEnabledRef.current = on;
      setLoopEnabledState(on);
    },
    [setLoop],
  );

  const resetAudio = useCallback(() => {
    const audio = getAudio();
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    durationRef.current = 0;
    lastTimeRef.current = 0;
    setLoop(null);
    setTrack(null);
    setPeaks(null);
    setIsPlaying(false);
  }, [getAudio, setLoop]);

  /** Drop the current track and show an error (also used for rejected drops). */
  const fail = useCallback(
    (message: string) => {
      loadToken.current += 1;
      resetAudio();
      setError(message);
      setStatus('error');
    },
    [resetAudio],
  );

  const load = useCallback(
    async (file: File) => {
      const token = ++loadToken.current;
      const audio = getAudio();
      resetAudio();
      setError(null);
      setStatus('loading');

      const url = URL.createObjectURL(file);
      urlRef.current = url;
      audio.src = url;
      // Loading a new source resets the rate, so set it again.
      audio.defaultPlaybackRate = rateRef.current;
      audio.playbackRate = rateRef.current;
      keepPitch(audio);
      audio.volume = volumeRef.current;

      const stale = () => token !== loadToken.current;

      const meta = await waitForMetadata(audio);
      if (stale()) return;
      if (!meta.ok) return fail(MESSAGES.unsupported);
      if (Number.isFinite(meta.duration) && meta.duration > MAX_DURATION_S) {
        return fail(MESSAGES.tooLong);
      }

      try {
        const buffer = await decodeFile(file);
        if (stale()) return;
        if (buffer.duration > MAX_DURATION_S) return fail(MESSAGES.tooLong);
        const computed = computePeaks(buffer);
        durationRef.current = buffer.duration;
        audio.currentTime = 0;
        lastTimeRef.current = 0;
        setPeaks(computed);
        setTrack({
          name: file.name,
          size: file.size,
          channels: buffer.numberOfChannels,
          duration: buffer.duration,
        });
        setStatus('ready');
      } catch {
        if (!stale()) fail(MESSAGES.unsupported);
      }
    },
    [getAudio, resetAudio, fail],
  );

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || durationRef.current === 0) return;
    const region = loopRef.current;
    if (loopEnabledRef.current && region && audio.currentTime >= region.end) {
      audio.currentTime = region.start;
      lastTimeRef.current = region.start;
    } else if (audio.currentTime >= durationRef.current - 0.01) {
      audio.currentTime = 0;
      lastTimeRef.current = 0;
    }
    playStartRef.current = audio.currentTime;
    void audio.play().catch(() => {});
  }, []);

  /** Stop playing; with the setting on, the playhead returns to where it started. */
  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    audio.pause();
    if (returnOnStopRef.current) {
      audio.currentTime = playStartRef.current;
      lastTimeRef.current = playStartRef.current;
    }
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) play();
    else pause();
  }, [play, pause]);

  const setReturnOnStop = useCallback((on: boolean) => {
    returnOnStopRef.current = on;
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || durationRef.current === 0) return;
    const t = clamp(seconds, 0, durationRef.current);
    audio.currentTime = t;
    // a click while playing becomes the new place to return to
    if (!audio.paused) playStartRef.current = t;
    lastTimeRef.current = t;
  }, []);

  const nudge = useCallback(
    (delta: number) => seek((audioRef.current?.currentTime ?? 0) + delta),
    [seek],
  );

  const setRate = useCallback((value: number) => {
    const next = Math.round(clamp(value, RATE_MIN, RATE_MAX) * 100) / 100;
    rateRef.current = next;
    const audio = audioRef.current;
    if (audio) {
      audio.defaultPlaybackRate = next;
      audio.playbackRate = next;
    }
    setRateState(next);
  }, []);

  const setVolume = useCallback((value: number) => {
    const next = clamp(value, 0, 1);
    volumeRef.current = next;
    if (audioRef.current) audioRef.current.volume = next;
    setVolumeState(next);
  }, []);

  return {
    status,
    error,
    track,
    peaks,
    duration: track?.duration ?? 0,
    isPlaying,
    rate,
    volume,
    loop,
    loopEnabled,
    getTime,
    load,
    fail,
    play,
    pause,
    toggle,
    seek,
    nudge,
    setRate,
    setVolume,
    setLoop,
    setLoopEnabled,
    setReturnOnStop,
  };
}

export type Transport = ReturnType<typeof useAudioTransport>;
