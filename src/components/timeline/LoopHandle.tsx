import { Box } from '@chakra-ui/react';
import type { PointerEvent, RefObject } from 'react';
import { useRef } from 'react';
import { MIN_LOOP, type LoopRegion, type Transport } from '../../audio/useAudioTransport';
import { clamp } from '../../lib/format';
import { palette } from '../../theme/palette';

interface Props {
  kind: 'start' | 'end';
  region: LoopRegion;
  enabled: boolean;
  pps: number;
  duration: number;
  rulerHeight: number;
  contentRef: RefObject<HTMLDivElement | null>;
  setLoop: Transport['setLoop'];
}

/** A draggable loop locator: a flag in the ruler and a line through the waveform. */
export function LoopHandle({
  kind,
  region,
  enabled,
  pps,
  duration,
  rulerHeight,
  contentRef,
  setLoop,
}: Props) {
  const fixedEdge = useRef<number | null>(null);
  const x = (kind === 'start' ? region.start : region.end) * pps;
  const color = enabled ? palette.cherry : palette.parchmentFaint;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    fixedEdge.current = kind === 'start' ? region.end : region.start;
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const fixed = fixedEdge.current;
    const content = contentRef.current;
    if (fixed === null || !content) return;
    const t = clamp((e.clientX - content.getBoundingClientRect().left) / pps, 0, duration);
    setLoop(
      kind === 'start'
        ? { start: Math.min(t, fixed - MIN_LOOP), end: fixed }
        : { start: fixed, end: Math.max(t, fixed + MIN_LOOP) },
    );
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    fixedEdge.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };

  return (
    <Box position="absolute" top="0" bottom="0" left={`${x}px`} w="0" zIndex={3}>
      {/* grab zone along the line */}
      <Box
        position="absolute"
        top="0"
        bottom="0"
        left="-6px"
        w="12px"
        cursor="ew-resize"
        touchAction="none"
        {...handlers}
      />
      {/* grab zone on the flag */}
      <Box
        position="absolute"
        top="0"
        h={`${rulerHeight}px`}
        left={kind === 'start' ? '-6px' : '-18px'}
        w="24px"
        cursor="ew-resize"
        touchAction="none"
        {...handlers}
      />
      <Box
        pointerEvents="none"
        position="absolute"
        top="0"
        bottom="0"
        left="-1px"
        w="2px"
        bg={color}
        opacity={enabled ? 0.9 : 0.55}
      />
      <Box
        pointerEvents="none"
        position="absolute"
        top="4px"
        left={kind === 'start' ? '-1px' : '-13px'}
        w="14px"
        h="17px"
        bg={color}
        borderRadius={kind === 'start' ? '0 4px 4px 0' : '4px 0 0 4px'}
        boxShadow="0 1px 3px rgba(0,0,0,0.5)"
      />
    </Box>
  );
}
