import {
  Accidental,
  BarlineType,
  Beam,
  CanvasContext,
  Clef,
  Fraction,
  Stave,
  StaveNote,
  TickContext,
  TimeSignature,
  Tuplet,
  Voice,
} from 'vexflow/bravura';
import { palette } from '../theme/palette';
import type { FretNote } from './fingering';
import { BEATS_PER_BAR, type Subdivision } from './exercise';
import { STRING_NAMES } from './theory';

export const STAFF_H = 150;
export const TAB_H = 118;
const STAVE_Y = 26;
const HEADER_W = 78;
const BAR_PAD = 14;
const TAB_TOP = STAFF_H + 18;
const TAB_GAP = 15;

export interface ScoreLayout {
  slots: (FretNote | null)[];
  subdivision: Subdivision;
  perBar: number;
  bars: number;
  barW: number;
  width: number;
  /** x of the notehead's left edge for slot i */
  noteX: (i: number) => number;
}

export function scoreLayout(slots: (FretNote | null)[], subdivision: Subdivision): ScoreLayout {
  const perBar = BEATS_PER_BAR * subdivision;
  const bars = Math.max(1, Math.ceil(slots.length / perBar));
  // roomy enough for sixteenths with accidentals, wide enough for quarters to breathe
  const barW = Math.max(260, perBar * 36);
  const noteX = (i: number) => {
    const bar = Math.floor(i / perBar);
    const inBar = i % perBar;
    return HEADER_W + bar * barW + BAR_PAD + (inBar / perBar) * (barW - BAR_PAD);
  };
  return { slots, subdivision, perBar, bars, barW, width: HEADER_W + bars * barW + 24, noteX };
}

const SHARP_KEYS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const FLAT_KEYS = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];

/** guitar is written an octave higher than it sounds */
function writtenKey(midi: number, flats: boolean) {
  const w = midi + 12;
  return `${(flats ? FLAT_KEYS : SHARP_KEYS)[w % 12]}/${Math.floor(w / 12) - 1}`;
}

const DURATION: Record<Subdivision, string> = { 1: 'q', 2: '8', 3: '8', 4: '16' };
const ink = { fillStyle: palette.parchment, strokeStyle: palette.parchment };
const faint = { fillStyle: 'rgba(241,230,204,0.34)', strokeStyle: 'rgba(241,230,204,0.34)' };
const muted = { fillStyle: palette.parchmentMuted, strokeStyle: palette.parchmentMuted };

export const tabStringY = (s: number) => TAB_TOP + (5 - s) * TAB_GAP; // high e on top

/** Staff (and optionally tab) for one pass of the exercise. */
export function drawScore(
  ctx: CanvasRenderingContext2D,
  layout: ScoreLayout,
  opts: { showTab: boolean; flats: boolean },
) {
  const vf = new CanvasContext(ctx);
  vf.setFillStyle(palette.parchment);
  vf.setStrokeStyle(palette.parchment);

  // clef and time signature
  const head = new Stave(6, STAVE_Y, HEADER_W - 6);
  head.setStyle(faint).setBegBarType(BarlineType.SINGLE).setEndBarType(BarlineType.NONE);
  head.addModifier(new Clef('treble', 'default', '8vb').setStyle(muted));
  head.addModifier(new TimeSignature(`${BEATS_PER_BAR}/4`).setStyle(muted));
  head.setContext(vf).draw();

  const { perBar, barW, subdivision } = layout;
  for (let b = 0; b < layout.bars; b++) {
    const x0 = HEADER_W + b * barW;
    const stave = new Stave(x0, STAVE_Y, barW);
    stave.setStyle(faint).setBegBarType(BarlineType.NONE);
    if (b === layout.bars - 1) stave.setEndBarType(BarlineType.REPEAT_END);
    stave.setContext(vf).draw();

    const slots = layout.slots.slice(b * perBar, (b + 1) * perBar);
    const notes = slots.map((n) => {
      const rest = n === null;
      const note = new StaveNote({
        keys: rest ? ['b/4'] : [writtenKey(n.midi, opts.flats)],
        duration: DURATION[subdivision] + (rest ? 'r' : ''),
        auto_stem: !rest,
        clef: 'treble',
      });
      note.setStyle(rest ? muted : ink);
      note.setLedgerLineStyle(faint);
      note.setStave(stave);
      return note;
    });
    const tuplets: Tuplet[] = [];
    if (subdivision === 3) {
      for (let i = 0; i < notes.length; i += 3) {
        tuplets.push(new Tuplet(notes.slice(i, i + 3), { num_notes: 3, notes_occupied: 2 }));
      }
    }
    const voice = new Voice({ num_beats: BEATS_PER_BAR, beat_value: 4 })
      .setMode(Voice.Mode.SOFT)
      .addTickables(notes);
    Accidental.applyAccidentals([voice], 'C');

    const noteStart = stave.getNoteStartX();
    notes.forEach((note, i) => {
      const x = layout.noteX(b * perBar + i);
      const tc = new TickContext();
      tc.addTickable(note).preFormat();
      tc.setX(x - noteStart);
      tc.setX(tc.getX() + x - note.getNoteHeadBeginX());
    });
    const beams =
      subdivision === 1 ? [] : Beam.generateBeams(notes, { groups: [new Fraction(1, 4)] });
    for (const n of notes) n.setContext(vf).draw();
    for (const bm of beams) bm.setStyle(ink).setContext(vf).draw();
    for (const t of tuplets) t.setContext(vf).draw();
  }

  if (!opts.showTab) return;

  // tab: six lines, fret numbers at the same x as the noteheads
  ctx.font = "600 10px 'Instrument Sans Variable', system-ui, sans-serif";
  ctx.textBaseline = 'middle';
  ctx.fillStyle = palette.parchmentFaint;
  for (let s = 0; s < 6; s++) {
    const y = tabStringY(s);
    ctx.fillStyle = 'rgba(241,230,204,0.3)';
    ctx.fillRect(6, Math.round(y), layout.width - 30, 1);
    ctx.fillStyle = palette.parchmentFaint;
    ctx.fillText(STRING_NAMES[s], 10, y);
  }
  ctx.font = "700 15px 'Newsreader Variable', Georgia, serif";
  ctx.fillStyle = palette.parchmentMuted;
  ctx.fillText('T', 30, tabStringY(4));
  ctx.fillText('A', 30, tabStringY(2.5));
  ctx.fillText('B', 30, tabStringY(1));
  for (let b = 0; b <= layout.bars; b++) {
    const x = HEADER_W + b * barW;
    ctx.fillStyle = 'rgba(241,230,204,0.34)';
    ctx.fillRect(x, tabStringY(5), 1, tabStringY(0) - tabStringY(5) + 1);
  }
  layout.slots.forEach((n, i) => drawFret(ctx, layout, n, i, false));
}

const NOTE_CENTER = 6;

function drawFret(
  ctx: CanvasRenderingContext2D,
  layout: ScoreLayout,
  n: FretNote | null,
  i: number,
  lit: boolean,
) {
  if (!n) return;
  const cx = layout.noteX(i) + NOTE_CENTER;
  const cy = tabStringY(n.string);
  ctx.beginPath();
  ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
  ctx.fillStyle = lit ? palette.honey : palette.walnut;
  ctx.fill();
  if (n.degree === 1 && !lit) {
    ctx.strokeStyle = palette.cherry;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.font = "600 11px 'Instrument Sans Variable', system-ui, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = lit ? palette.espresso : palette.parchment;
  ctx.fillText(String(n.fret), cx, cy + 0.5);
  ctx.textAlign = 'left';
  if (n.slide) {
    ctx.fillStyle = lit ? palette.espresso : palette.honey;
    ctx.font = "700 9px 'Instrument Sans Variable', system-ui, sans-serif";
    ctx.fillText('sl.', cx - 20, cy - 10);
  }
}

/** Overlay: marks the current slot on the staff and lights its bolletje on the tab. */
export function drawScoreHighlight(
  ctx: CanvasRenderingContext2D,
  layout: ScoreLayout,
  slot: number,
  showTab: boolean,
) {
  if (slot < 0 || slot >= layout.slots.length) return;
  const x = layout.noteX(slot) + NOTE_CENTER;
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
    drawFret(ctx, layout, layout.slots[slot], slot, true);
    ctx.restore();
  }
}
