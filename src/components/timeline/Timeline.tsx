import { Box, chakra, Flex, IconButton, Text } from '@chakra-ui/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { LuAudioWaveform, LuLocateFixed, LuMaximize2, LuZoomIn, LuZoomOut } from 'react-icons/lu';
import type { TrackInfo, Transport } from '../../audio/useAudioTransport';
import { useFrame } from '../../hooks/useFrame';
import { clamp, formatBytes, formatTime } from '../../lib/format';
import { palette } from '../../theme/palette';
import { Hint } from '../Hint';
import { drawRuler, drawWaveform } from './drawing';
import { LoopHandle } from './LoopHandle';
import { useWindowedCanvas, type DrawFn } from './useWindowedCanvas';

export const RULER_H = 30;
export const WAVE_H = 184;
const LANE_H = RULER_H + WAVE_H;
const END_PAD = 28;
const MAX_PPS = 800;
const ZOOM_STEP = 1.5;
const DRAG_THRESHOLD_PX = 4;

interface Props {
  transport: Transport;
  track: TrackInfo;
}

/**
 * One shared time axis. Every lane (waveform now, notation and tab later) lives in
 * the same horizontally scrolling content box, so x = time × pixels-per-second
 * holds for all of them, and one playhead and loop region cut through all lanes.
 */
export function Timeline({ transport, track }: Props) {
  const { peaks, loop, loopEnabled, setLoop, seek, getTime } = transport;
  const duration = track.duration;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rulerCanvas = useRef<HTMLCanvasElement>(null);
  const dimCanvas = useRef<HTMLCanvasElement>(null);
  const litCanvas = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  const [viewportW, setViewportW] = useState(0);
  const [userPps, setUserPps] = useState<number | null>(null); // null = fit to width
  const [follow, setFollow] = useState(true);

  const fitPps = viewportW > 0 ? Math.max(0.5, (viewportW - END_PAD) / duration) : 50;
  const pps = clamp(userPps ?? fitPps, fitPps, MAX_PPS);
  const contentWidth = Math.max(viewportW, Math.floor(duration * pps) + END_PAD);
  const atFit = pps <= fitPps * 1.001;

  // Latest values for the frame loop and native listeners.
  const ppsRef = useRef(pps);
  const fitRef = useRef(fitPps);
  const followRef = useRef(follow);
  useLayoutEffect(() => {
    ppsRef.current = pps;
    fitRef.current = fitPps;
    followRef.current = follow;
  });

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setViewportW(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ---- zoom, anchored on a screen position so the time under it stays put ----
  const anchor = useRef<{ time: number; x: number } | null>(null);

  const zoomTo = useCallback((next: number, anchorX?: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const x = anchorX ?? el.clientWidth / 2;
    anchor.current = { time: (el.scrollLeft + x) / ppsRef.current, x };
    const clamped = clamp(next, fitRef.current, MAX_PPS);
    setUserPps(clamped <= fitRef.current * 1.001 ? null : clamped);
  }, []);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    const a = anchor.current;
    if (el && a) {
      el.scrollLeft = a.time * pps - a.x;
      anchor.current = null;
    }
  }, [pps]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // plain scrolling stays native
      e.preventDefault();
      const left = el.getBoundingClientRect().left;
      zoomTo(ppsRef.current * Math.exp(-e.deltaY * 0.0025), e.clientX - left);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomTo]);

  // ---- canvases ----
  const drawRulerLane = useCallback<DrawFn>(
    (ctx, scrollLeft, w, h) => drawRuler(ctx, scrollLeft, w, h, pps, duration),
    [pps, duration],
  );
  const drawDim = useCallback<DrawFn>(
    (ctx, scrollLeft, w, h) => {
      if (peaks) drawWaveform(ctx, 'dim', scrollLeft, w, h, pps, peaks);
    },
    [pps, peaks],
  );
  const drawLit = useCallback<DrawFn>(
    (ctx, scrollLeft, w, h) => {
      if (peaks) drawWaveform(ctx, 'lit', scrollLeft, w, h, pps, peaks);
    },
    [pps, peaks],
  );
  useWindowedCanvas(rulerCanvas, scrollerRef, RULER_H, drawRulerLane);
  useWindowedCanvas(dimCanvas, scrollerRef, WAVE_H, drawDim);
  useWindowedCanvas(litCanvas, scrollerRef, WAVE_H, drawLit);

  // ---- playhead, played-part highlight, follow-scroll ----
  const lastTime = useRef(-1);
  const lastClip = useRef('');
  useFrame(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const t = getTime();
    const x = t * ppsRef.current;

    if (followRef.current && t !== lastTime.current) {
      const vw = scroller.clientWidth;
      const left = scroller.scrollLeft;
      if (x > left + vw * 0.92 || x < left) scroller.scrollLeft = Math.max(0, x - vw * 0.1);
    }
    lastTime.current = t;

    if (playheadRef.current) playheadRef.current.style.transform = `translate3d(${x}px,0,0)`;

    if (litCanvas.current) {
      const w = scroller.clientWidth;
      const litW = clamp(x - scroller.scrollLeft, 0, w);
      const clip = `inset(0 ${w - litW}px 0 0)`;
      if (clip !== lastClip.current) {
        litCanvas.current.style.clipPath = clip;
        lastClip.current = clip;
      }
    }
  });

  // ---- click to seek, drag to define a loop ----
  const drag = useRef<{ startX: number; startT: number; moved: boolean } | null>(null);

  const timeAt = (clientX: number) => {
    const content = contentRef.current;
    if (!content) return 0;
    return clamp((clientX - content.getBoundingClientRect().left) / pps, 0, duration);
  };

  const onSurfaceDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startT: timeAt(e.clientX), moved: false };
  };
  const onSurfaceMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    const t = timeAt(e.clientX);
    setLoop({ start: Math.min(d.startT, t), end: Math.max(d.startT, t) }, true);
  };
  const onSurfaceUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (d && !d.moved && e.type === 'pointerup') seek(d.startT);
  };

  const loopTint = loopEnabled ? 'rgba(201,73,47,0.17)' : 'rgba(191,174,142,0.08)';
  const loopBar = loopEnabled ? 'rgba(201,73,47,0.38)' : 'rgba(191,174,142,0.16)';

  return (
    <Box>
      {/* toolbar: file info on the left, view controls on the right */}
      <Flex
        align="center"
        justify="space-between"
        gap="3"
        wrap="wrap"
        px={{ base: 3, md: 5 }}
        py="3"
        borderBottomWidth="1px"
        borderColor="border"
      >
        <Box minW="0">
          <Text
            fontFamily="heading"
            fontSize={{ base: 'lg', md: 'xl' }}
            fontWeight="500"
            lineHeight="1.2"
            lineClamp={1}
            title={track.name}
          >
            {track.name}
          </Text>
          <Text fontSize="xs" color="fg.muted" mt="0.5" fontVariantNumeric="tabular-nums">
            {formatTime(duration)} · {track.channels === 1 ? 'Mono' : 'Stereo'} ·{' '}
            {formatBytes(track.size)}
          </Text>
        </Box>

        <Flex align="center" gap="1">
          <Hint label="Uitzoomen">
            <IconButton
              aria-label="Uitzoomen"
              size="xs"
              variant="ghost"
              disabled={atFit}
              onClick={() => zoomTo(pps / ZOOM_STEP)}
            >
              <LuZoomOut />
            </IconButton>
          </Hint>
          <Hint label="Inzoomen (Ctrl + scrollen)">
            <IconButton
              aria-label="Inzoomen"
              size="xs"
              variant="ghost"
              disabled={pps >= MAX_PPS}
              onClick={() => zoomTo(pps * ZOOM_STEP)}
            >
              <LuZoomIn />
            </IconButton>
          </Hint>
          <Hint label="Hele opname in beeld">
            <IconButton
              aria-label="Hele opname in beeld"
              size="xs"
              variant="ghost"
              disabled={atFit}
              onClick={() => setUserPps(null)}
            >
              <LuMaximize2 />
            </IconButton>
          </Hint>
          <Hint label={follow ? 'Afspeelkop volgen: aan' : 'Afspeelkop volgen: uit'}>
            <IconButton
              aria-label="Afspeelkop volgen"
              aria-pressed={follow}
              size="xs"
              variant={follow ? 'subtle' : 'ghost'}
              colorPalette={follow ? 'brass' : 'gray'}
              onClick={() => setFollow((v) => !v)}
            >
              <LuLocateFixed />
            </IconButton>
          </Hint>
        </Flex>
      </Flex>

      <Flex align="stretch">
        {/* lane header, where the notation and tab lanes will get their own */}
        <Box
          display={{ base: 'none', md: 'block' }}
          w="112px"
          flexShrink={0}
          borderRightWidth="1px"
          borderColor="border"
          bg="bg.subtle"
        >
          <Box h={`${RULER_H}px`} borderBottomWidth="1px" borderColor="border" />
          <Flex
            h={`${WAVE_H}px`}
            direction="column"
            align="center"
            justify="center"
            gap="1.5"
            color="fg.muted"
          >
            <LuAudioWaveform size={20} color={palette.brass} />
            <Text fontFamily="heading" fontStyle="italic" fontSize="md" color="fg">
              Opname
            </Text>
          </Flex>
        </Box>

        <Box
          ref={scrollerRef}
          flex="1"
          minW="0"
          overflowX="auto"
          overflowY="hidden"
          position="relative"
        >
          <Box ref={contentRef} position="relative" h={`${LANE_H}px`} w={`${contentWidth}px`}>
            {/* viewport-sized layer: backgrounds and canvases stay put while content scrolls */}
            <Box
              position="sticky"
              left="0"
              top="0"
              w={`${viewportW}px`}
              h="100%"
              overflow="hidden"
              zIndex={0}
            >
              <Box
                position="absolute"
                top="0"
                left="0"
                right="0"
                h={`${RULER_H}px`}
                bg="bg.subtle"
                borderBottomWidth="1px"
                borderColor="border"
              />
              <Box
                position="absolute"
                top={`${RULER_H}px`}
                left="0"
                right="0"
                bottom="0"
                css={{
                  background:
                    'radial-gradient(ellipse 75% 130% at 50% 0%, rgba(240,180,90,0.15), transparent 72%),' +
                    'linear-gradient(180deg, #1e140d, #120b07)',
                }}
              />
              <chakra.canvas
                ref={rulerCanvas}
                position="absolute"
                top="0"
                left="0"
                aria-hidden="true"
              />
              <chakra.canvas
                ref={dimCanvas}
                position="absolute"
                top={`${RULER_H}px`}
                left="0"
                aria-hidden="true"
              />
              <chakra.canvas
                ref={litCanvas}
                position="absolute"
                top={`${RULER_H}px`}
                left="0"
                aria-hidden="true"
                css={{ filter: 'drop-shadow(0 0 6px rgba(240,180,90,0.28))' }}
              />
            </Box>

            {/* loop region */}
            {loop && (
              <>
                <Box
                  pointerEvents="none"
                  position="absolute"
                  top="0"
                  bottom="0"
                  left={`${loop.start * pps}px`}
                  w={`${(loop.end - loop.start) * pps}px`}
                  bg={loopTint}
                  zIndex={1}
                />
                <Box
                  pointerEvents="none"
                  position="absolute"
                  top="0"
                  h={`${RULER_H}px`}
                  left={`${loop.start * pps}px`}
                  w={`${(loop.end - loop.start) * pps}px`}
                  bg={loopBar}
                  zIndex={1}
                />
              </>
            )}

            {/* click = seek, drag = new loop */}
            <Box
              position="absolute"
              inset="0"
              zIndex={2}
              touchAction="pan-x pinch-zoom"
              onPointerDown={onSurfaceDown}
              onPointerMove={onSurfaceMove}
              onPointerUp={onSurfaceUp}
              onPointerCancel={onSurfaceUp}
            />

            {loop && (
              <>
                {(['start', 'end'] as const).map((kind) => (
                  <LoopHandle
                    key={kind}
                    kind={kind}
                    region={loop}
                    enabled={loopEnabled}
                    pps={pps}
                    duration={duration}
                    rulerHeight={RULER_H}
                    contentRef={contentRef}
                    setLoop={setLoop}
                  />
                ))}
              </>
            )}

            {/* playhead */}
            <Box
              ref={playheadRef}
              position="absolute"
              top="0"
              bottom="0"
              left="0"
              w="0"
              zIndex={4}
              pointerEvents="none"
              willChange="transform"
            >
              <Box
                position="absolute"
                top="0"
                bottom="0"
                left="-1px"
                w="2px"
                bg={palette.parchment}
                boxShadow="0 0 10px 1px rgba(240,180,90,0.65)"
              />
              <Box
                position="absolute"
                top="0"
                left="-6px"
                w="0"
                h="0"
                borderLeft="6px solid transparent"
                borderRight="6px solid transparent"
                borderTop={`9px solid ${palette.parchment}`}
              />
            </Box>
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}
