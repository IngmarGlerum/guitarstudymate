import {
  Accidental,
  BarlineType,
  Beam,
  CanvasContext,
  Clef,
  Dot,
  Stave,
  StaveNote,
  StaveTie,
  TickContext,
  TimeSignature,
  Tuplet,
} from 'vexflow/bravura';
import { palette } from '../theme/palette';
import { chordName, type Chord } from './chords';
import { STAFF_H, tabStringY } from './drawScore';
import { BAR_TICKS, type LickExercise, type LickEvent } from './licks';
import { STRING_NAMES } from './theory';

/**
 * The staff for a lick: real note values (quarters, dotted notes, ties, triplets,
 * rests), spaced by time like the rest of the app, with tab and chords.
 */

const STAVE_Y = 26;
const HEADER_W = 78;
const BAR_PAD = 14;
const NOTE_CENTER = 6;

export interface LickLayout {
  ex: LickExercise;
  barW: number;
  width: number;
  /** x of the notehead's left edge at tick t */
  noteX: (t: number) => number;
  /** index of the event sounding at slot (tick) t, or -1 */
  eventAt: (t: number) => number;
}

export function lickLayout(ex: LickExercise): LickLayout {
  const fine = ex.events.some((e) => e.dur < 6);
  const barW = fine ? 470 : 360;
  const noteX = (t: number) => {
    const bar = Math.floor(t / BAR_TICKS);
    return HEADER_W + bar * barW + BAR_PAD + ((t - bar * BAR_TICKS) / BAR_TICKS) * (barW - BAR_PAD * 2);
  };
  // the note (not rest) that started last at or before t, following ties back to their head
  const starts = ex.events.map((e) => e.start);
  const eventAt = (t: number) => {
    let i = -1;
    for (let k = 0; k < starts.length && starts[k] <= t; k++) i = k;
    if (i < 0) return -1;
    const e = ex.events[i];
    if (e.written === null || t >= e.start + e.dur) return -1;
    while (i > 0 && ex.events[i - 1].tie && ex.events[i - 1].written === e.written) i--;
    return i;
  };
  return { ex, barW, width: HEADER_W + ex.bars * barW + 24, noteX, eventAt };
}

const ink = { fillStyle: palette.parchment, strokeStyle: palette.parchment };
const faint = { fillStyle: 'rgba(241,230,204,0.34)', strokeStyle: 'rgba(241,230,204,0.34)' };
const muted = { fillStyle: palette.parchmentMuted, strokeStyle: palette.parchmentMuted };

/** duration code for VexFlow; triplet values are written as the plain value under a 3 */
function code(e: LickEvent): { d: string; dots: number } {
  const len = e.tuplet >= 0 ? (e.dur * 3) / 2 : e.dur;
  const table: [number, string, number][] = [
    [48, 'w', 0], [36, 'h', 1], [24, 'h', 0], [18, 'q', 1], [12, 'q', 0], [9, '8', 1], [6, '8', 0], [4.5, '16', 1], [3, '16', 0], [1.5, '32', 0],
  ];
  const hit = table.find(([t]) => Math.abs(t - len) < 0.01) ?? [12, 'q', 0];
  return { d: hit[1], dots: hit[2] };
}

const VF_ACC: Record<string, string> = { '#': '#', b: 'b', '##': '##', bb: 'bb', n: 'n' };

export function drawLick(ctx: CanvasRenderingContext2D, layout: LickLayout, opts: { showTab: boolean; flats: boolean }) {
  const vf = new CanvasContext(ctx);
  vf.setFillStyle(palette.parchment);
  vf.setStrokeStyle(palette.parchment);
  const { ex, barW } = layout;

  const head = new Stave(6, STAVE_Y, HEADER_W - 6);
  head.setStyle(faint).setBegBarType(BarlineType.SINGLE).setEndBarType(BarlineType.NONE);
  head.addModifier(new Clef('treble', 'default', '8vb').setStyle(muted));
  head.addModifier(new TimeSignature('4/4').setStyle(muted));
  head.setContext(vf).draw();

  const vfNotes: (StaveNote | null)[] = ex.events.map(() => null);
  for (let b = 0; b < ex.bars; b++) {
    const stave = new Stave(HEADER_W + b * barW, STAVE_Y, barW);
    stave.setStyle(faint).setBegBarType(BarlineType.NONE);
    if (b === ex.bars - 1) stave.setEndBarType(BarlineType.REPEAT_END);
    stave.setContext(vf).draw();

    const inBar = ex.events.map((e, i) => ({ e, i })).filter(({ e }) => Math.floor(e.start / BAR_TICKS + 1e-6) === b);
    // accidentals as written: shown when the note differs from what the bar already set
    const state = new Map<string, string>();
    const notes = inBar.map(({ e, i }) => {
      const rest = e.written === null;
      const { d, dots } = code(e);
      const oct = rest ? 4 : Math.floor((e.written! - ACC_OFFSET(e.accidental)) / 12) - 1;
      const key = rest ? (d === 'w' ? 'd/5' : 'b/4') : `${e.letter}${e.accidental === 'n' ? '' : e.accidental}/${oct}`;
      const n = new StaveNote({ keys: [key], duration: d + (rest ? 'r' : ''), auto_stem: !rest, clef: 'treble' });
      n.setStyle(rest ? muted : ink);
      n.setLedgerLineStyle(faint);
      n.setStave(stave);
      if (dots) Dot.buildAndAttach([n], { all: true });
      if (!rest) {
        const slot = `${e.letter}${oct}`;
        const acc = e.accidental === '' ? 'n' : e.accidental;
        const shown = state.get(slot) ?? 'n';
        if (acc !== shown) n.addModifier(new Accidental(VF_ACC[acc]).setStyle(ink), 0);
        state.set(slot, acc);
      }
      vfNotes[i] = n;
      return { n, e };
    });

    const noteStart = stave.getNoteStartX();
    for (const { n, e } of notes) {
      const x = layout.noteX(e.start);
      const tc = new TickContext();
      tc.addTickable(n).preFormat();
      tc.setX(x - noteStart);
      tc.setX(tc.getX() + x - n.getNoteHeadBeginX());
    }

    // beams: shorter-than-quarter notes in the same half bar 
    const beams: Beam[] = [];
    let group: StaveNote[] = [];
    let key = '';
    const flush = () => {
      if (group.length > 1) beams.push(new Beam(group, true));
      group = [];
    };
    for (const { n, e } of notes) {
      const beamable = e.written !== null && ['8', '16', '32'].includes(code(e).d);
      const k = `${Math.floor((e.start - b * BAR_TICKS) / 24)}`;
      if (!beamable || k !== key) flush();
      key = k;
      if (beamable) group.push(n);
    }
    flush();

    const tuplets = [...new Set(notes.filter(({ e }) => e.tuplet >= 0).map(({ e }) => e.tuplet))].map(
      (t) =>
        new Tuplet(
          notes.filter(({ e }) => e.tuplet === t).map(({ n }) => n),
          { num_notes: 3, notes_occupied: 2, bracketed: true },
        ),
    );
    for (const { n } of notes) n.setContext(vf).draw();
    for (const bm of beams) bm.setStyle(ink).setContext(vf).draw();
    for (const t of tuplets) t.setContext(vf).draw();
  }

  // ties, also across a barline
  ex.events.forEach((e, i) => {
    const a = vfNotes[i];
    const z = vfNotes[i + 1];
    if (!e.tie || !a || !z) return;
    new StaveTie({ first_note: a, last_note: z, first_indices: [0], last_indices: [0] }).setContext(vf).draw();
  });

  ctx.textBaseline = 'alphabetic';
  ex.chords.forEach((c, b) => {
    if (b > 0 && sameChord(c, ex.chords[b - 1])) return;
    drawChord(ctx, layout, c, b, false, opts.flats);
  });

  if (!opts.showTab) return;
  ctx.font = "600 10px 'Instrument Sans Variable', system-ui, sans-serif";
  ctx.textBaseline = 'middle';
  for (let s = 0; s < 6; s++) {
    const y = tabStringY(s);
    ctx.fillStyle = 'rgba(241,230,204,0.3)';
    ctx.fillRect(6, Math.round(y), layout.width - 30, 1);
    ctx.fillStyle = palette.parchmentFaint;
    ctx.fillText(STRING_NAMES[s], 10, y);
  }
  for (let b = 0; b <= ex.bars; b++) {
    ctx.fillStyle = 'rgba(241,230,204,0.34)';
    ctx.fillRect(HEADER_W + b * barW, tabStringY(5), 1, tabStringY(0) - tabStringY(5) + 1);
  }
  ex.events.forEach((e, i) => {
    const prev = ex.events[i - 1];
    if (prev?.tie && prev.written === e.written) return; // a tied note is played once
    drawTabFret(ctx, layout, i, false);
  });
}

const ACC_OFFSET = (acc: LickEvent['accidental']) => ({ '': 0, n: 0, '#': 1, '##': 2, b: -1, bb: -2 })[acc];
const sameChord = (a: Chord, b: Chord) => a.rootPc === b.rootPc && a.type === b.type;

function drawChord(ctx: CanvasRenderingContext2D, layout: LickLayout, c: Chord, bar: number, lit: boolean, flats: boolean) {
  const x = layout.noteX(bar * BAR_TICKS);
  const text = chordName(c, flats);
  ctx.font = "600 14px 'Newsreader Variable', Georgia, serif";
  ctx.textBaseline = 'alphabetic';
  if (lit) {
    ctx.fillStyle = 'rgba(240,180,90,0.18)';
    ctx.fillRect(x - 4, 1, ctx.measureText(text).width + 8, 19);
  }
  ctx.fillStyle = lit ? palette.honeyLight : palette.parchmentMuted;
  ctx.fillText(text, x, 15);
}

function drawTabFret(ctx: CanvasRenderingContext2D, layout: LickLayout, i: number, lit: boolean) {
  const n = layout.ex.places[i];
  if (!n) return;
  const cx = layout.noteX(layout.ex.events[i].start) + NOTE_CENTER;
  const cy = tabStringY(n.string);
  ctx.beginPath();
  ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
  ctx.fillStyle = lit ? palette.honey : palette.walnut;
  ctx.fill();
  ctx.font = "600 11px 'Instrument Sans Variable', system-ui, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = lit ? palette.espresso : palette.parchment;
  ctx.fillText(String(n.fret), cx, cy + 0.5);
  ctx.textAlign = 'left';
}

/** Overlay: the sounding note on staff and tab, and its chord. */
export function drawLickHighlight(
  ctx: CanvasRenderingContext2D,
  layout: LickLayout,
  slot: number,
  showTab: boolean,
  flats: boolean,
) {
  if (slot < 0) return;
  const bar = Math.floor(slot / BAR_TICKS);
  let first = bar;
  const chords = layout.ex.chords;
  while (first > 0 && chords[first - 1] && chords[bar] && sameChord(chords[first - 1], chords[bar])) first--;
  if (chords[bar]) drawChord(ctx, layout, chords[bar], first, true, flats);
  const i = layout.eventAt(slot);
  if (i < 0) return;
  const x = layout.noteX(layout.ex.events[i].start) + NOTE_CENTER;
  const grad = ctx.createLinearGradient(0, STAVE_Y, 0, STAFF_H);
  grad.addColorStop(0, 'rgba(240,180,90,0)');
  grad.addColorStop(0.5, 'rgba(240,180,90,0.22)');
  grad.addColorStop(1, 'rgba(240,180,90,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 11, 8, 22, STAFF_H - 10);
  if (showTab) {
    ctx.save();
    ctx.shadowColor = 'rgba(240,180,90,0.8)';
    ctx.shadowBlur = 12;
    drawTabFret(ctx, layout, i, true);
    ctx.restore();
  }
}

/** The event nearest to x (for clicking a note), or -1. */
export function lickEventAtX(layout: LickLayout, x: number) {
  let best = -1;
  let dist = 16;
  layout.ex.events.forEach((e, i) => {
    if (e.written === null) return;
    const d = Math.abs(layout.noteX(e.start) + NOTE_CENTER - x);
    if (d < dist) {
      dist = d;
      best = i;
    }
  });
  return best;
}
