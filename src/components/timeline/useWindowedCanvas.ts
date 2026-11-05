import { useEffect, type RefObject } from 'react';

export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  scrollLeft: number,
  width: number,
  height: number,
) => void;

/**
 * A canvas that is only as wide as the scroll viewport and redraws the visible
 * time window whenever the scroller moves or `draw` changes. This keeps canvases
 * small regardless of zoom level or track length.
 */
export function useWindowedCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  scrollerRef: RefObject<HTMLElement | null>,
  height: number,
  draw: DrawFn,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const scroller = scrollerRef.current;
    if (!canvas || !scroller) return;

    let raf = 0;
    const render = () => {
      raf = 0;
      const dpr = window.devicePixelRatio || 1;
      const width = scroller.clientWidth;
      const pixelW = Math.max(1, Math.round(width * dpr));
      const pixelH = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW;
        canvas.height = pixelH;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      draw(ctx, scroller.scrollLeft, width, height);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(render);
    };

    schedule();
    scroller.addEventListener('scroll', schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(scroller);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      scroller.removeEventListener('scroll', schedule);
      observer.disconnect();
    };
  }, [canvasRef, scrollerRef, height, draw]);
}
