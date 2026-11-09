import { Box, Button, chakra, Flex, IconButton, SegmentGroup, Slider, Switch, Text } from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { LuBookmark, LuPlay, LuSquare } from 'react-icons/lu';
import { overlayContext, useCanvas } from '../../hooks/useCanvas';
import { useFrame } from '../../hooks/useFrame';
import { useStoredState } from '../../hooks/useStoredState';
import { drawNeck, drawNeckHighlight, NECK_H, neckLayout } from '../../technique/drawNeck';
import {
  drawScore,
  drawScoreHighlight,
  scoreLayout,
  STAFF_H,
  TAB_H,
} from '../../technique/drawScore';
import { PracticeEngine } from '../../technique/engine';
import { fingeringFor, formulaFor, layoutPass } from '../../technique/exercise';
import { usePresets } from '../../technique/presets';
import { useExerciseSettings } from '../../technique/settings';
import type { FretNote } from '../../technique/fingering';
import { previewNotes } from '../../technique/preview';
import { pcName, ROOTS } from '../../technique/theory';
import { Hint } from '../Hint';
import { ExerciseSettingsPanel } from './ExerciseSettingsPanel';
import { PatternDialog } from './PatternDialog';
import { PresetsDialog } from './PresetsDialog';
import type { LatencyState } from '../../audio/latency';

type View = 'neck' | 'tab';
const isView = (v: unknown): v is View => v === 'neck' || v === 'tab';

interface AudioPrefs {
  guitarOn: boolean;
  guitarVolume: number;
  clickVolume: number;
  countIn: boolean;
}
const DEFAULT_AUDIO: AudioPrefs = { guitarOn: true, guitarVolume: 0.8, clickVolume: 0.6, countIn: true };
const isAudio = (v: unknown): v is AudioPrefs =>
  typeof v === 'object' && v !== null && 'guitarOn' in v && 'clickVolume' in v;

const thumbShadow = '0 0 0 2px #1a1009, 0 2px 6px rgba(0,0,0,0.6)';
const trackBg = 'rgba(241,230,204,0.16)';

/** The Techniek mode: a configurable exercise, a metronome, and notes that light up in sync. */
export function TechniqueView({
  active,
  latency,
  onCalibrate,
}: {
  active: boolean;
  latency: LatencyState;
  onCalibrate: () => void;
}) {
  const { settings, update, replace, perStringOptions, positionOptions } = useExerciseSettings();
  const presets = usePresets();
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [view, setView] = useStoredState<View>('gsm.technique.view', 'neck', isView);
  const [audio, setAudio] = useStoredState<AudioPrefs>('gsm.audio', DEFAULT_AUDIO, isAudio);
  const [playing, setPlaying] = useState(false);
  const [patternOpen, setPatternOpen] = useState(false);

  const engineRef = useRef<PracticeEngine | null>(null);
  const engine = () => (engineRef.current ??= new PracticeEngine());
  useEffect(() => () => engineRef.current?.dispose(), []);

  const latencyMs = latency.calibration?.ms ?? null;
  useEffect(() => {
    engine().setLatency(latencyMs === null ? null : latencyMs / 1000);
  }, [latencyMs]);
  // hint to calibrate: after the first play without a calibration, or after a device change
  const [hasPlayed, setHasPlayed] = useState(false);
  const showTimingHint = latency.deviceChanged || (hasPlayed && latencyMs === null);

  useEffect(() => {
    const e = engine();
    e.setGuitarOn(audio.guitarOn);
    e.setGuitarVolume(audio.guitarVolume);
    e.setClickVolume(audio.clickVolume);
  }, [audio]);

  const flats = ROOTS.find((r) => r.pc === settings.rootPc)?.flats ?? false;
  const fingering = useMemo(() => fingeringFor(settings), [settings]);
  const slots = useMemo(() => layoutPass(settings), [settings]);
  const layout = useMemo(() => scoreLayout(slots, settings.subdivision), [slots, settings.subdivision]);
  const showTab = view === 'tab';

  // ---- playback ----
  const startPlayback = useCallback(() => {
    if (slots.every((s) => s === null)) return;
    void engine().start({
      slots,
      subdivision: settings.subdivision,
      bpm: settings.bpm,
      repeats: settings.repeats,
      countIn: audio.countIn,
      ring: settings.kind === 'arpeggio',
      onEnd: () => setPlaying(false),
    });
    setPlaying(true);
    setHasPlayed(true);
  }, [slots, settings.subdivision, settings.bpm, settings.repeats, settings.kind, audio.countIn]);

  const stopPlayback = useCallback(() => {
    engineRef.current?.stop();
    setPlaying(false);
  }, []);

  // a changed exercise restarts playback, so what you hear always matches the screen
  const restartKey = `${JSON.stringify(slots.map((s) => s?.midi ?? -1))}|${settings.bpm}|${settings.subdivision}|${settings.repeats}|${settings.kind}`;
  const lastKey = useRef(restartKey);
  useEffect(() => {
    if (lastKey.current === restartKey) return;
    lastKey.current = restartKey;
    if (engineRef.current?.playing) startPlayback();
  }, [restartKey, startPlayback]);

  // switching modes stops playback
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) setPlaying(false);
  }
  useEffect(() => {
    if (!active) engineRef.current?.stop();
  }, [active]);

  // Space toggles play while this mode is visible
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && t.closest('input, textarea, select, [role="slider"], [role="dialog"]')) return;
      e.preventDefault();
      if (engineRef.current?.playing) stopPlayback();
      else startPlayback();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, startPlayback, stopPlayback]);

  // ---- canvases ----
  const scoreRef = useRef<HTMLCanvasElement>(null);
  const scoreOverlayRef = useRef<HTMLCanvasElement>(null);
  const scoreScroller = useRef<HTMLDivElement>(null);
  const scoreH = STAFF_H + (showTab ? TAB_H : 0);
  const drawScoreBase = useCallback(
    (ctx: CanvasRenderingContext2D) => drawScore(ctx, layout, { showTab, flats }),
    [layout, showTab, flats],
  );
  useCanvas(scoreRef, layout.width, scoreH, drawScoreBase);
  useCanvas(scoreOverlayRef, layout.width, scoreH, noop);

  const neckBox = useRef<HTMLDivElement>(null);
  const [neckW, setNeckW] = useState(0);
  useEffect(() => {
    const el = neckBox.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setNeckW(el.clientWidth));
    ro.observe(el);
    setNeckW(el.clientWidth);
    return () => ro.disconnect();
  }, [view]);
  const maxFret = fingering ? Math.max(...fingering.notes.map((n) => n.fret)) : 12;
  const neck = useMemo(() => neckLayout(Math.max(neckW, 600), maxFret), [neckW, maxFret]);
  // on narrow screens the neck scrolls: bring the fingering into view
  const minFret = fingering ? Math.min(...fingering.notes.map((n) => n.fret)) : 0;
  useEffect(() => {
    const el = neckBox.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = Math.max(0, neck.noteX(minFret) - 40);
  }, [neck, minFret, view]);
  const neckRef = useRef<HTMLCanvasElement>(null);
  const neckOverlayRef = useRef<HTMLCanvasElement>(null);
  const drawNeckBase = useCallback(
    (ctx: CanvasRenderingContext2D) => drawNeck(ctx, neck, fingering?.notes ?? [], flats),
    [neck, fingering, flats],
  );
  useCanvas(neckRef, view === 'neck' ? neck.width : 0, NECK_H, drawNeckBase);
  useCanvas(neckOverlayRef, view === 'neck' ? neck.width : 0, NECK_H, noop);

  // ---- click a note (staff, tab or neck) to hear it; it lights up briefly ----
  const preview = useRef<{ slot: number; note: FretNote; until: number } | null>(null);
  const PREVIEW_MS = 450;
  const onScoreClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    let best = -1;
    let dist = 16; // px tolerance around the notehead
    layout.slots.forEach((n, i) => {
      const d = n ? Math.abs(layout.noteX(i) + 6 - x) : Infinity;
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    const note = best >= 0 ? layout.slots[best] : null;
    if (!note) return;
    previewNotes([note.midi]);
    preview.current = { slot: best, note, until: performance.now() + PREVIEW_MS };
  };
  const onNeckClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!fingering) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const hit = fingering.notes.find(
      (n) => Math.hypot(neck.noteX(n.fret) - x, neck.stringY(n.string) - y) <= 13,
    );
    if (!hit) return;
    previewNotes([hit.midi]);
    const slot = layout.slots.findIndex((s) => s === hit);
    preview.current = { slot, note: hit, until: performance.now() + PREVIEW_MS };
  };

  // ---- sync: redraw the highlights only when the sounding slot changes ----
  const statusRef = useRef<HTMLSpanElement>(null);
  const shown = useRef({ slot: -2, key: '', previewNote: null as FretNote | null });
  const frameState = useRef({ layout, neck, showTab, flats, view });
  useEffect(() => {
    frameState.current = { layout, neck, showTab, flats, view };
    shown.current.key = ''; // force a redraw after a layout change
  });
  useFrame(() => {
    const pos = engineRef.current?.position() ?? null;
    // while stopped, a clicked note lights up for a moment
    const pv = !pos && preview.current && performance.now() < preview.current.until ? preview.current : null;
    const slot = pos ? pos.slot : pv ? pv.slot : -2;
    const neckNote = pv ? pv.note : slot >= 0 ? (frameState.current.layout.slots[slot] ?? null) : null;
    const st = frameState.current;
    const key = `${st.view}|${st.showTab}|${st.layout.width}|${st.neck.width}`;
    if (slot === shown.current.slot && key === shown.current.key && neckNote === shown.current.previewNote) return;
    shown.current = { slot, key, previewNote: neckNote };
    if (statusRef.current) {
      statusRef.current.textContent = pos?.countIn ? 'Voortellen…' : '';
    }
    const sctx = overlayContext(scoreOverlayRef.current);
    if (sctx) drawScoreHighlight(sctx, st.layout, slot, st.showTab);
    const nctx = st.view === 'neck' ? overlayContext(neckOverlayRef.current) : null;
    if (nctx) drawNeckHighlight(nctx, st.neck, neckNote, st.flats);
    // keep the current note in view
    const scroller = scoreScroller.current;
    if (scroller && slot >= 0 && !pv) {
      const x = st.layout.noteX(slot);
      if (x < scroller.scrollLeft + 40 || x > scroller.scrollLeft + scroller.clientWidth - 60) {
        scroller.scrollLeft = Math.max(0, x - scroller.clientWidth * 0.25);
      }
    }
  });

  const formula = formulaFor(settings);
  const title =
    settings.kind === 'arpeggio'
      ? `${pcName(settings.rootPc, flats)} ${formula.label.toLowerCase()} arpeggio`
      : `${pcName(settings.rootPc, flats)} ${formula.label.toLowerCase()}${settings.kind === 'pattern' ? ` · patroon ${settings.pattern.join(' ')}` : ''}`;
  const empty = slots.every((s) => s === null);

  return (
    <Box
      rounded="lg"
      overflow="hidden"
      borderWidth="1px"
      borderColor="border"
      bg="bg.panel"
      css={{ boxShadow: '0 24px 70px rgba(0,0,0,0.5), 0 0 90px rgba(217,164,65,0.06)' }}
    >
      <Box px={{ base: 3, md: 5 }} py="4" borderBottomWidth="1px" borderColor="border">
        <Flex align="center" justify="space-between" gap="3" mb="3">
          <Text fontFamily="heading" fontSize={{ base: 'lg', md: 'xl' }} fontWeight="500" minW="0">
            {title}
          </Text>
          <Button size="sm" variant="outline" colorPalette="brass" onClick={() => setPresetsOpen(true)}>
            <LuBookmark /> Presets
          </Button>
        </Flex>
        <ExerciseSettingsPanel
          settings={settings}
          update={update}
          perStringOptions={perStringOptions}
          positionOptions={positionOptions}
          onEditPattern={() => setPatternOpen(true)}
        />
      </Box>

      {/* notenbalk (and tab), always on top */}
      <Box ref={scoreScroller} overflowX="auto" overflowY="hidden" position="relative" bg="#170f0a">
        {empty ? (
          <Flex h={`${STAFF_H}px`} align="center" justify="center" px="4">
            <Text fontSize="sm" color="fg.muted" textAlign="center">
              Dit patroon past nergens helemaal in deze vingerzetting. Kies een korter patroon of
              meer noten per snaar.
            </Text>
          </Flex>
        ) : (
          <Box position="relative" w={`${layout.width}px`} h={`${scoreH}px`}>
            <chakra.canvas ref={scoreRef} position="absolute" inset="0" aria-hidden="true" />
            <chakra.canvas
              ref={scoreOverlayRef}
              position="absolute"
              inset="0"
              aria-hidden="true"
              cursor="pointer"
              onClick={onScoreClick}
            />
          </Box>
        )}
      </Box>

      <Flex
        align="center"
        justify="space-between"
        gap="3"
        wrap="wrap"
        px={{ base: 3, md: 5 }}
        py="2.5"
        borderTopWidth="1px"
        borderColor="border"
        bg="bg.subtle"
      >
        <SegmentGroup.Root
          size="sm"
          value={view}
          onValueChange={(e) => e.value && setView(e.value as View)}
          aria-label="Weergave"
        >
          <SegmentGroup.Indicator />
          <SegmentGroup.Items
            items={[
              { value: 'tab', label: 'Tab' },
              { value: 'neck', label: 'Gitaarhals' },
            ]}
          />
        </SegmentGroup.Root>
        <Text fontSize="xs" color="fg.muted">
          {fingering ? `${fingering.notes.length} noten in deze vingerzetting` : ''}
        </Text>
      </Flex>

      {view === 'neck' && (
        <Box ref={neckBox} overflowX="auto" bg="#140d09" borderTopWidth="1px" borderColor="border">
          <Box position="relative" w={`${neck.width}px`} h={`${NECK_H}px`}>
            <chakra.canvas ref={neckRef} position="absolute" inset="0" aria-hidden="true" />
            <chakra.canvas
              ref={neckOverlayRef}
              position="absolute"
              inset="0"
              aria-hidden="true"
              cursor="pointer"
              onClick={onNeckClick}
            />
          </Box>
        </Box>
      )}

      {/* transport */}
      <Flex
        wrap="wrap"
        align="center"
        gap={{ base: 4, lg: 7 }}
        px={{ base: 3, md: 5 }}
        py="4"
        borderTopWidth="1px"
        borderColor="border"
        css={{ backgroundImage: 'var(--wood-grain)', backgroundColor: '#1a1009' }}
      >
        <Flex align="center" gap="3">
          <Hint label={playing ? 'Stoppen (spatie)' : 'Afspelen (spatie)'}>
            <IconButton
              aria-label={playing ? 'Stoppen' : 'Afspelen'}
              rounded="full"
              size="xl"
              colorPalette="brass"
              variant="solid"
              disabled={empty}
              onClick={playing ? stopPlayback : startPlayback}
            >
              {playing ? <LuSquare /> : <LuPlay />}
            </IconButton>
          </Hint>
          <Flex direction="column">
            <Text fontFamily="heading" fontSize="xl" lineHeight="1" fontVariantNumeric="tabular-nums">
              {settings.bpm} BPM
            </Text>
            <Text fontSize="xs" color="fg.muted" minH="1.2em">
              <span ref={statusRef} />
            </Text>
            {showTimingHint && (
              <Button size="2xs" variant="plain" color="brass.300" px="0" h="auto" onClick={onCalibrate}>
                {latency.deviceChanged ? 'Ander audioapparaat? Timing afstemmen' : 'Timing nog niet afgestemd · Afstemmen'}
              </Button>
            )}
          </Flex>
        </Flex>

        <Switch.Root
          checked={audio.countIn}
          onCheckedChange={(e) => setAudio({ ...audio, countIn: e.checked })}
          colorPalette="brass"
          size="sm"
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Label fontSize="sm">Voortellen</Switch.Label>
        </Switch.Root>

        <Flex align="center" gap="3" minW="220px" flex="1" maxW="320px">
          <Switch.Root
            checked={audio.guitarOn}
            onCheckedChange={(e) => setAudio({ ...audio, guitarOn: e.checked })}
            colorPalette="brass"
            size="sm"
          >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Label fontSize="sm">Gitaar</Switch.Label>
          </Switch.Root>
          <VolumeSlider
            label="Volume gitaar"
            value={audio.guitarVolume}
            disabled={!audio.guitarOn}
            onChange={(v) => setAudio({ ...audio, guitarVolume: v })}
          />
        </Flex>

        <Flex align="center" gap="3" minW="220px" flex="1" maxW="320px">
          <Text fontSize="sm">Metronoom</Text>
          <VolumeSlider
            label="Volume metronoom"
            value={audio.clickVolume}
            onChange={(v) => setAudio({ ...audio, clickVolume: v })}
          />
        </Flex>
      </Flex>

      <PresetsDialog
        open={presetsOpen}
        onClose={() => setPresetsOpen(false)}
        current={settings}
        onLoad={replace}
        presets={presets}
      />
      <PatternDialog
        open={patternOpen}
        initial={settings.pattern}
        onClose={() => setPatternOpen(false)}
        onApply={(pattern) => {
          update({ kind: 'pattern', pattern });
          setPatternOpen(false);
        }}
      />
    </Box>
  );
}

function noop() {}

function VolumeSlider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <Slider.Root
      size="sm"
      variant="solid"
      colorPalette="brass"
      min={0}
      max={1}
      step={0.05}
      value={[value]}
      disabled={disabled}
      onValueChange={(d) => onChange(d.value[0])}
      flex="1"
      aria-label={[label]}
    >
      <Slider.Control>
        <Slider.Track bg={trackBg}>
          <Slider.Range />
        </Slider.Track>
        <Slider.Thumb index={0} boxShadow={thumbShadow}>
          <Slider.HiddenInput />
        </Slider.Thumb>
      </Slider.Control>
    </Slider.Root>
  );
}
