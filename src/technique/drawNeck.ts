import { palette } from '../theme/palette';
import type { FretNote } from './fingering';
import { pcName, STRING_NAMES } from './theory';

export const NECK_H = 190;
const TOP = 26;
const STRING_GAP = 26;
const NUT_X = 44;
const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];

export interface NeckLayout {
  width: number;
  frets: number;
  /** x of fret wire f (f = 0 is the nut) */
  fretX: (f: number) => number;
  /** x where a note on fret f is drawn (between wires, or left of the nut for 0) */
  noteX: (f: number) => number;
  stringY: (s: number) => number;
}

/** Real fret spacing (each fret 2^(-1/12) of the previous), scaled to the width. */
export function neckLayout(width: number, maxFret: number): NeckLayout {
  const frets = Math.max(12, Math.min(22, maxFret + 2));
  const end = width - 16;
  const rel = (f: number) => 1 - 2 ** (-f / 12);
  const fretX = (f: number) => NUT_X + (rel(f) / rel(frets)) * (end - NUT_X);
  const noteX = (f: number) => (f === 0 ? NUT_X - 16 : (fretX(f - 1) + fretX(f)) / 2);
  const stringY = (s: number) => TOP + (5 - s) * STRING_GAP; // high e on top, like tab
  return { width, frets, fretX, noteX, stringY };
}

/** The fingerboard with every note of the fingering as a dim bolletje. */
export function drawNeck(
  ctx: CanvasRenderingContext2D,
  layout: NeckLayout,
  notes: FretNote[],
  flats: boolean,
) {
  const { fretX, stringY, frets } = layout;
  const top = stringY(5) - 12;
  const bottom = stringY(0) + 12;

  // rosewood board
  const board = ctx.createLinearGradient(0, top, 0, bottom);
  board.addColorStop(0, '#2a1a10');
  board.addColorStop(0.5, '#33200f');
  board.addColorStop(1, '#24160d');
  ctx.fillStyle = board;
  ctx.fillRect(NUT_X, top, fretX(frets) - NUT_X, bottom - top);

  // inlays
  ctx.fillStyle = 'rgba(241,230,204,0.22)';
  const mid = (stringY(2) + stringY(3)) / 2;
  for (const f of INLAYS) {
    if (f > frets) continue;
    ctx.beginPath();
    ctx.arc((fretX(f - 1) + fretX(f)) / 2, mid, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (frets >= 12) {
    const x = (fretX(11) + fretX(12)) / 2;
    for (const y of [(stringY(1) + stringY(2)) / 2, (stringY(3) + stringY(4)) / 2]) {
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // nut and fret wires
  ctx.fillStyle = palette.parchment;
  ctx.fillRect(NUT_X - 4, top, 4, bottom - top);
  for (let f = 1; f <= frets; f++) {
    ctx.fillStyle = 'rgba(205,200,190,0.55)';
    ctx.fillRect(Math.round(fretX(f)) - 1, top, 2, bottom - top);
  }

  // fret numbers
  ctx.font = "500 10px 'Instrument Sans Variable', system-ui, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = palette.parchmentFaint;
  for (let f = 1; f <= frets; f++) {
    if (INLAYS.includes(f) || f === 12 || f === 1) {
      ctx.fillText(String(f), (fretX(f - 1) + fretX(f)) / 2, bottom + 16);
    }
  }

  // strings, heavier for the low ones
  for (let s = 0; s < 6; s++) {
    const y = stringY(s);
    ctx.fillStyle = s < 3 ? 'rgba(214,190,140,0.75)' : 'rgba(225,220,210,0.7)';
    const h = [2.2, 1.9, 1.6, 1.3, 1.1, 0.9][s];
    ctx.fillRect(NUT_X - 24, y - h / 2, fretX(frets) - NUT_X + 24, h);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.parchmentFaint;
    ctx.fillText(STRING_NAMES[s], 4, y);
  }

  // slides (four notes per string): an arrow from the note before
  for (let i = 1; i < notes.length; i++) {
    const n = notes[i];
    const p = notes[i - 1];
    if (!n.slide || p.string !== n.string) continue;
    const y = stringY(n.string) - 14;
    const x1 = layout.noteX(p.fret);
    const x2 = layout.noteX(n.fret);
    ctx.strokeStyle = palette.honey;
    ctx.fillStyle = palette.honey;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2 - 4, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y);
    ctx.lineTo(x2 - 6, y - 3.5);
    ctx.lineTo(x2 - 6, y + 3.5);
    ctx.fill();
  }

  // the fingering's notes
  const done = new Set<string>();
  for (const n of notes) {
    const key = `${n.string}:${n.fret}`;
    if (done.has(key)) continue;
    done.add(key);
    drawDot(ctx, layout, n, false, flats);
  }
  ctx.textAlign = 'left';
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  layout: NeckLayout,
  n: FretNote,
  lit: boolean,
  flats: boolean,
) {
  const x = layout.noteX(n.fret);
  const y = layout.stringY(n.string);
  const root = n.degree === 1;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fillStyle = lit ? palette.honey : root ? palette.cherryDeep : palette.mahogany;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = lit ? palette.honeyLight : root ? palette.cherry : palette.tweed;
  ctx.stroke();
  ctx.font = "600 9.5px 'Instrument Sans Variable', system-ui, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = lit ? palette.espresso : palette.parchment;
  ctx.fillText(pcName(n.midi % 12, flats), x, y + 0.5);
}

/** Overlay: the bolletje of the note that sounds now. */
export function drawNeckHighlight(
  ctx: CanvasRenderingContext2D,
  layout: NeckLayout,
  note: FretNote | null,
  flats: boolean,
) {
  if (!note) return;
  ctx.save();
  ctx.shadowColor = 'rgba(240,180,90,0.9)';
  ctx.shadowBlur = 16;
  drawDot(ctx, layout, note, true, flats);
  ctx.restore();
}

/**
 * Progressions: the current chord's scale inside the window as dim dots, its
 * target with a double ring (V-3), and the sounding note lit.
 */
export function drawNeckProgression(
  ctx: CanvasRenderingContext2D,
  layout: NeckLayout,
  box: FretNote[],
  target: FretNote | null,
  sounding: FretNote | null,
  windowLo: number,
  flats: boolean,
  approaches: FretNote[] = [],
) {
  // the window as a soft band behind the dots
  const x1 = windowLo === 0 ? 0 : layout.fretX(Math.max(0, windowLo - 1));
  const x2 = layout.fretX(Math.min(layout.frets, windowLo + 4));
  ctx.fillStyle = 'rgba(240,180,90,0.07)';
  ctx.fillRect(x1, layout.stringY(5) - 14, x2 - x1, layout.stringY(0) - layout.stringY(5) + 28);
  for (const n of box) drawDot(ctx, layout, n, false, flats);
  // approach notes (enclosures): a dashed ring, also outside the window
  for (const n of approaches) {
    if (!box.some((b) => b.string === n.string && b.fret === n.fret)) drawDot(ctx, layout, n, false, flats);
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = palette.honey;
    ctx.beginPath();
    ctx.arc(layout.noteX(n.fret), layout.stringY(n.string), 13.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (target) {
    const x = layout.noteX(target.fret);
    const y = layout.stringY(target.string);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = palette.brass;
    ctx.beginPath();
    ctx.arc(x, y, 13.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (sounding) drawNeckHighlight(ctx, layout, sounding, flats);
}
