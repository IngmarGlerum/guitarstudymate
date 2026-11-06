import { Box, Button, chakra, Flex, IconButton, Text } from '@chakra-ui/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import {
  LuAudioWaveform,
  LuDownload,
  LuLocateFixed,
  LuMaximize2,
  LuMusic,
  LuMusic4,
  LuSparkles,
  LuX,
  LuZoomIn,
  LuZoomOut,
} from 'react-icons/lu';
import type { TrackInfo, Transport } from '../../audio/useAudioTransport';
import { useFrame } from '../../hooks/useFrame';
import { clamp, formatBytes, formatTime } from '../../lib/format';
import { palette } from '../../theme/palette';
import { Hint } from '../Hint';
import { downloadDocument, noteName, toDocument } from '../../transcription/notes';
import type { Transcription } from '../../transcription/useTranscription';
import type { Notation } from '../../notation/useNotation';
import { barDuration } from '../../notation/tempo';
import { NotationControls } from '../NotationControls';
import { drawNotes, drawRuler, drawWaveform, layoutNotes } from './drawing';
import { drawNotation, MIN_BAR_PX } from './drawNotation';
import { LoopHandle } from './LoopHandle';
import { useWindowedCanvas, type DrawFn } from './useWindowedCanvas';

export const RULER_H = 30;
export const WAVE_H = 184;
export const NOTATION_H = 176;
export const NOTES_H = 196;
const NOTATION_TOP = RULER_H + WAVE_H;
const NOTES_TOP = NOTATION_TOP + NOTATION_H;
const LANE_H = NOTES_TOP + NOTES_H;
const END_PAD = 28;
const MAX_PPS = 800;
const ZOOM_STEP = 1.5;
const DRAG_THRESHOLD_PX = 4;

interface Props {
  transport: Transport;
  track: TrackInfo;
  transcription: Transcription;
  onTranscribe: () => void;
  notation: Notation;
}

const STAGE_LABEL = {
  decoding: 'Opname voorbereiden',
  model: 'Model laden',
  analyse: 'Noten herkennen',
  notes: 'Noten uitschrijven',
} as const;

/**
 * One shared time axis. Every lane (waveform now, notation and tab later) lives in
 * the same horizontally scrolling content box, so x = time × pixels-per-second
 * holds for all of them, and one playhead and loop region cut through all lanes.
 */
export function Timeline({ transport, track, transcription, onTranscribe, notation }: Props) {
  const { peaks, loop, loopEnabled, setLoop, seek, getTime } = transport;
  const duration = track.duration;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rulerCanvas = useRef<HTMLCanvasElement>(null);
  const dimCanvas = useRef<HTMLCanvasElement>(null);
  const litCanvas = useRef<HTMLCanvasElement>(null);
  const notesDimCanvas = useRef<HTMLCanvasElement>(null);
  const notesLitCanvas = useRef<HTMLCanvasElement>(null);
  const notationCanvas = useRef<HTMLCanvasElement>(null);
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
  const { notes } = transcription;
  const noteLayout = useMemo(() => layoutNotes(notation.display), [notation.display]);
  const drawNotesDim = useCallback<DrawFn>(
    (ctx, scrollLeft, w, h) => drawNotes(ctx, 'dim', scrollLeft, w, h, pps, duration, noteLayout),
    [pps, duration, noteLayout],
  );
  const drawNotesLit = useCallback<DrawFn>(
    (ctx, scrollLeft, w, h) => drawNotes(ctx, 'lit', scrollLeft, w, h, pps, duration, noteLayout),
    [pps, duration, noteLayout],
  );
  const { tempo, bars } = notation;
  const drawNotationLane = useCallback<DrawFn>(
    (ctx, scrollLeft, w, h) => {
      if (tempo) drawNotation(ctx, scrollLeft, w, h, pps, duration, tempo, bars);
    },
    [pps, duration, tempo, bars],
  );
  useWindowedCanvas(notationCanvas, scrollerRef, NOTATION_H, drawNotationLane);
  useWindowedCanvas(rulerCanvas, scrollerRef, RULER_H, drawRulerLane);
  useWindowedCanvas(notesDimCanvas, scrollerRef, NOTES_H, drawNotesDim);
  useWindowedCanvas(notesLitCanvas, scrollerRef, NOTES_H, drawNotesLit);
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

    const w = scroller.clientWidth;
    const litW = clamp(x - scroller.scrollLeft, 0, w);
    const clip = `inset(0 ${w - litW}px 0 0)`;
    if (clip !== lastClip.current) {
      if (litCanvas.current) litCanvas.current.style.clipPath = clip;
      if (notesLitCanvas.current) notesLitCanvas.current.style.clipPath = clip;
      lastClip.current = clip;
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

        <Flex align="center" gap="1" wrap="wrap">
          <TranscribeControls
            transcription={transcription}
            onTranscribe={onTranscribe}
            onExport={() => downloadDocument(toDocument(notation.kept, track.name, duration))}
          />
          <Box w="1px" h="5" bg="border" mx="1.5" aria-hidden="true" />
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

      {notes && notes.length > 0 && (
        <NotationControls notation={notation} getTime={getTime} totalNotes={notes.length} />
      )}

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
          <Flex
            h={`${NOTATION_H}px`}
            direction="column"
            align="center"
            justify="center"
            gap="1.5"
            color="fg.muted"
            borderTopWidth="1px"
            borderColor="border"
          >
            <LuMusic4 size={20} color={palette.brass} />
            <Text fontFamily="heading" fontStyle="italic" fontSize="md" color="fg">
              Notatie
            </Text>
            {tempo && (
              <Text fontSize="xs" fontVariantNumeric="tabular-nums">
                {tempo.bpm} BPM · {tempo.beatsPerBar}/4
              </Text>
            )}
          </Flex>
          <Flex
            h={`${NOTES_H}px`}
            direction="column"
            align="center"
            justify="center"
            gap="1.5"
            color="fg.muted"
            borderTopWidth="1px"
            borderColor="border"
          >
            <LuMusic size={20} color={palette.brass} />
            <Text fontFamily="heading" fontStyle="italic" fontSize="md" color="fg">
              Noten
            </Text>
            {notes && notes.length > 0 && (
              <Text fontSize="xs" fontVariantNumeric="tabular-nums">
                {noteName(Math.min(...notes.map((n) => n.midi)))}–
                {noteName(Math.max(...notes.map((n) => n.midi)))}
              </Text>
            )}
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

              {/* notation lane */}
              <Box
                position="absolute"
                top={`${NOTATION_TOP}px`}
                left="0"
                right="0"
                h={`${NOTATION_H}px`}
                borderTopWidth="1px"
                borderColor="border"
                css={{ background: 'linear-gradient(180deg, #1c130d, #170f0a)' }}
              />
              <chakra.canvas
                ref={notationCanvas}
                position="absolute"
                top={`${NOTATION_TOP}px`}
                left="0"
                aria-hidden="true"
              />
              <NotationLaneMessage
                hasNotes={(notes?.length ?? 0) > 0}
                hasTempo={tempo !== null}
                tooNarrow={tempo !== null && barDuration(tempo) * pps < MIN_BAR_PX}
              />

              {/* notes lane */}
              <Box
                position="absolute"
                top={`${NOTES_TOP}px`}
                left="0"
                right="0"
                bottom="0"
                borderTopWidth="1px"
                borderColor="border"
                css={{ background: 'linear-gradient(180deg, #160e09, #110a06)' }}
              />
              <chakra.canvas
                ref={notesDimCanvas}
                position="absolute"
                top={`${NOTES_TOP}px`}
                left="0"
                aria-hidden="true"
              />
              <chakra.canvas
                ref={notesLitCanvas}
                position="absolute"
                top={`${NOTES_TOP}px`}
                left="0"
                aria-hidden="true"
                css={{ filter: 'drop-shadow(0 0 4px rgba(240,180,90,0.22))' }}
              />
              <NotesLaneMessage transcription={transcription} />
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

function TranscribeControls({
  transcription,
  onTranscribe,
  onExport,
}: {
  transcription: Transcription;
  onTranscribe: () => void;
  onExport: () => void;
}) {
  const { status, busy, notes, cancel } = transcription;

  if (busy) {
    return (
      <Hint label="Notenherkenning stoppen">
        <IconButton aria-label="Notenherkenning stoppen" size="xs" variant="ghost" onClick={cancel}>
          <LuX />
        </IconButton>
      </Hint>
    );
  }

  return (
    <>
      <Button size="xs" variant="outline" colorPalette="brass" onClick={onTranscribe}>
        <LuSparkles /> {status === 'done' ? 'Opnieuw herkennen' : 'Noten herkennen'}
      </Button>
      {notes && notes.length > 0 && (
        <Hint label="Noten opslaan als JSON">
          <IconButton aria-label="Noten opslaan als JSON" size="xs" variant="ghost" onClick={onExport}>
            <LuDownload />
          </IconButton>
        </Hint>
      )}
    </>
  );
}

/** Empty, busy and error states, centred in the visible part of the notes lane. */
function NotesLaneMessage({ transcription }: { transcription: Transcription }) {
  const { status, progress, notes, error, busy, backend } = transcription;
  let text: string | null = null;
  if (status === 'idle') text = 'Kies ‘Noten herkennen’ om de noten uit de opname te halen.';
  else if (busy) {
    const label = STAGE_LABEL[status as keyof typeof STAGE_LABEL];
    text = status === 'analyse' ? `${label}… ${Math.round(progress * 100)}%` : `${label}…`;
    if (status === 'analyse' && backend === 'cpu') text += ' Zonder grafische versnelling duurt dit langer.';
  } else if (status === 'error') text = error;
  else if (status === 'done' && notes?.length === 0) text = 'Geen noten gevonden in deze opname.';
  if (!text) return null;

  return (
    <Flex
      position="absolute"
      top={`${NOTES_TOP}px`}
      left="0"
      right="0"
      bottom="0"
      direction="column"
      align="center"
      justify="center"
      gap="2.5"
      px="4"
      pointerEvents="none"
      zIndex={1}
    >
      <Text
        fontSize="sm"
        color={status === 'error' ? 'cherry.300' : 'fg.muted'}
        textAlign="center"
        role={status === 'error' ? 'alert' : 'status'}
        fontVariantNumeric="tabular-nums"
      >
        {text}
      </Text>
      {busy && (
        <Box w="min(280px, 70%)" h="3px" rounded="full" bg="whiteAlpha.100" overflow="hidden">
          <Box
            h="full"
            bg="brass.400"
            w={`${status === 'analyse' || status === 'notes' ? Math.max(2, progress * 100) : 2}%`}
            transition="width 0.2s linear"
            css={{ '@media (prefers-reduced-motion: reduce)': { transition: 'none' } }}
          />
        </Box>
      )}
    </Flex>
  );
}

function NotationLaneMessage({
  hasNotes,
  hasTempo,
  tooNarrow,
}: {
  hasNotes: boolean;
  hasTempo: boolean;
  tooNarrow: boolean;
}) {
  const text = !hasNotes
    ? 'Herken eerst de noten; daarna komt hier de notatie.'
    : !hasTempo
      ? 'Vul het tempo in of tik het mee om de noten in maten te zetten.'
      : tooNarrow
        ? 'Zoom in om de noten te lezen.'
        : null;
  if (!text) return null;
  return (
    <Flex
      position="absolute"
      top={`${NOTATION_TOP}px`}
      left="0"
      right="0"
      h={`${NOTATION_H}px`}
      align={hasTempo ? 'flex-end' : 'center'}
      justify="center"
      pb={hasTempo ? '3' : '0'}
      px="4"
      pointerEvents="none"
      zIndex={1}
    >
      <Text fontSize="sm" color="fg.muted" textAlign="center" role="status">
        {text}
      </Text>
    </Flex>
  );
}
