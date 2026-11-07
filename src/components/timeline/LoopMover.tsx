import { Box } from '@chakra-ui/react';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { LuGripHorizontal, LuX } from 'react-icons/lu';
import type { LoopRegion, Transport } from '../../audio/useAudioTransport';
import { clamp, formatTime } from '../../lib/format';
import { palette } from '../../theme/palette';

interface Props {
  region: LoopRegion;
  enabled: boolean;
  pps: number;
  duration: number;
  rulerHeight: number;
  setLoop: Transport['setLoop'];
  /** a click without dragging still seeks, like anywhere else in the ruler */
  onTap: (clientX: number) => void;
}

/** room left free at both ends for the locator flags */
const FLAG_ROOM = 16;
const KEY_STEP = 0.1;
const KEY_STEP_LARGE = 1;
const DRAG_THRESHOLD_PX = 3;

/**
 * Grab strip in the ruler between the two locators: drag it to move the whole
 * loop without changing its length. A grip appears on hover and keyboard focus.
 */
export function LoopMover({ region, enabled, pps, duration, rulerHeight, setLoop, onTap }: Props) {
  const drag = useRef<{ x: number; start: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const length = region.end - region.start;
  const left = region.start * pps + FLAG_ROOM;
  const width = length * pps - 2 * FLAG_ROOM;
  if (width < 8) return null;

  const moveTo = (start: number) => {
    const s = clamp(start, 0, Math.max(0, duration - length));
    setLoop({ start: s, end: s + length });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, start: region.start, moved: false };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    // released somewhere we did not hear about: stop, never keep following the mouse
    if ((e.buttons & 1) === 0) {
      drag.current = null;
      setDragging(false);
      return;
    }
    if (!d.moved && Math.abs(e.clientX - d.x) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    moveTo(d.start + (e.clientX - d.x) / pps);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && e.type === 'pointerup') onTap(e.clientX);
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      setLoop(null);
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    e.stopPropagation();
    const step = (e.shiftKey ? KEY_STEP_LARGE : KEY_STEP) * (e.key === 'ArrowLeft' ? -1 : 1);
    moveTo(region.start + step);
  };

  const color = enabled ? palette.cherry : palette.parchmentMuted;

  return (
    <Box
      role="slider"
      tabIndex={0}
      aria-label="Loop verschuiven"
      aria-valuemin={0}
      aria-valuemax={Math.max(0, duration - length)}
      aria-valuenow={region.start}
      aria-valuetext={`Loop van ${formatTime(region.start, 1)} tot ${formatTime(region.end, 1)}`}
      data-dragging={dragging || undefined}
      position="absolute"
      top="0"
      h={`${rulerHeight}px`}
      left={`${left}px`}
      w={`${width}px`}
      zIndex={3}
      cursor={dragging ? 'grabbing' : 'grab'}
      touchAction="none"
      outline="none"
      rounded="sm"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={() => {
        drag.current = null;
        setDragging(false);
      }}
      onKeyDown={onKeyDown}
      css={{
        '& .loop-grip, & .loop-clear': { opacity: 0, transition: 'opacity 0.12s ease' },
        '&:hover .loop-grip, &:focus-visible .loop-grip, &[data-dragging] .loop-grip': { opacity: 1 },
        '&:hover .loop-clear, &:focus-within .loop-clear': { opacity: 1 },
        '&:hover, &[data-dragging]': { background: 'rgba(241,230,204,0.06)' },
        '&:focus-visible': { boxShadow: `inset 0 0 0 2px ${palette.brass}` },
        '@media (prefers-reduced-motion: reduce)': {
          '& .loop-grip, & .loop-clear': { transition: 'none' },
        },
      }}
    >
      <Box
        className="loop-grip"
        pointerEvents="none"
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px="1.5"
        h="16px"
        rounded="full"
        bg={color}
        color={palette.espresso}
        boxShadow="0 1px 3px rgba(0,0,0,0.5)"
      >
        <LuGripHorizontal size={14} />
      </Box>
      {width >= 70 && (
        <Box
          as="button"
          className="loop-clear"
          aria-label="Loop wissen"
          title="Loop wissen (Delete)"
          position="absolute"
          top="50%"
          right="2px"
          transform="translateY(-50%)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          boxSize="16px"
          rounded="full"
          bg="rgba(20,13,9,0.75)"
          color={palette.parchment}
          cursor="pointer"
          tabIndex={-1}
          onPointerDown={(e: PointerEvent<HTMLElement>) => e.stopPropagation()}
          onClick={(e: { stopPropagation: () => void }) => {
            e.stopPropagation();
            setLoop(null);
          }}
          _hover={{ bg: palette.cherry }}
        >
          <LuX size={11} />
        </Box>
      )}
    </Box>
  );
}
