import { useEffect, type RefObject } from 'react';

/** Size a canvas for the device pixel ratio and (re)draw it when `draw` changes. */
export function useCanvas(
  ref: RefObject<HTMLCanvasElement | null>,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || width <= 0) return;
    // keep very wide canvases under the browser's size limit
    const dpr = Math.min(window.devicePixelRatio || 1, 16000 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    draw(ctx);
  }, [ref, width, height, draw]);
}

/** Clear a DPR-sized canvas and hand back its context for an overlay redraw. */
export function overlayContext(canvas: HTMLCanvasElement | null) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const scale = canvas.width / (parseFloat(canvas.style.width) || canvas.width);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return ctx;
}
