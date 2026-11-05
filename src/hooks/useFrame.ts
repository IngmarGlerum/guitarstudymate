import { useEffect, useLayoutEffect, useRef } from 'react';

/** Run a callback on every animation frame (for playhead, time readout). */
export function useFrame(callback: () => void) {
  const ref = useRef(callback);
  useLayoutEffect(() => {
    ref.current = callback;
  });
  useEffect(() => {
    let id = 0;
    const loop = () => {
      ref.current();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
}
