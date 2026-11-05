import { useEffect, useRef } from 'react';
import { MIN_LOOP, type Transport } from '../audio/useAudioTransport';

const RATE_STEP = 0.05;

/**
 * Space play/pause · ←/→ ±1 s (Shift ±5 s) · Home to start/loop start
 * L loop on/off · [ ] loop start/end at playhead · , . slower/faster
 */
export function useHotkeys(transport: Transport) {
  const latest = useRef(transport);
  useEffect(() => {
    latest.current = transport;
  });

  useEffect(() => {
    const ignore = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      target.closest('input, textarea, select, [contenteditable="true"]') !== null;
    const onSlider = (target: EventTarget | null) =>
      target instanceof HTMLElement && target.closest('[role="slider"]') !== null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || ignore(e.target)) return;
      const t = latest.current;
      if (t.status !== 'ready') return;

      if (e.code === 'Space') {
        e.preventDefault();
        t.toggle();
        return;
      }
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (onSlider(e.target)) return;
          e.preventDefault();
          const step = e.shiftKey ? 5 : 1;
          t.nudge(e.key === 'ArrowLeft' ? -step : step);
          return;
        }
        case 'Home': {
          if (onSlider(e.target)) return;
          e.preventDefault();
          t.seek(t.loopEnabled && t.loop ? t.loop.start : 0);
          return;
        }
        case 'l':
        case 'L':
          t.setLoopEnabled(!t.loopEnabled);
          return;
        case '[': {
          const now = t.getTime();
          const end = t.loop && t.loop.end > now + MIN_LOOP ? t.loop.end : t.duration;
          t.setLoop({ start: now, end }, true);
          return;
        }
        case ']': {
          const now = t.getTime();
          const start = t.loop && t.loop.start < now - MIN_LOOP ? t.loop.start : 0;
          t.setLoop({ start, end: now }, true);
          return;
        }
        case ',':
          t.setRate(t.rate - RATE_STEP);
          return;
        case '.':
          t.setRate(t.rate + RATE_STEP);
          return;
      }
    };

    // A focused button would also activate on Space keyup, undoing our toggle.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || ignore(e.target)) return;
      if (latest.current.status === 'ready') e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}
