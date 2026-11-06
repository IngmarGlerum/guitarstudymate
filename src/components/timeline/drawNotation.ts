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
  Voice,
} from 'vexflow/bravura';
import { WRITABLE, type Bar, type Piece } from '../../notation/quantize';
import { barDuration, barStart, TICKS_PER_BEAT, type Tempo } from '../../notation/tempo';
import { palette } from '../../theme/palette';

/** y of the stave's top area; VexFlow puts the top line 4 spaces lower */
const STAVE_Y = 34;
/** horizontal room before the first sixteenth of a bar */
const BAR_PAD = 6;
/** below this bar width the notes would collide; only staves are drawn */
export const MIN_BAR_PX = 120;
const CLEF_PANEL_W = 62;

const SHARP_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

/** Guitar is written an octave above sounding pitch (treble clef with an 8 below). */
function writtenKey(midi: number) {
  const written = midi + 12;
  return `${SHARP_NAMES[written % 12]}/${Math.floor(written / 12) - 1}`;
}

const noteStyle = { fillStyle: palette.parchment, strokeStyle: palette.parchment };
const restStyle = { fillStyle: palette.parchmentMuted, strokeStyle: palette.parchmentMuted };
const staveStyle = { fillStyle: 'rgba(241,230,204,0.34)', strokeStyle: 'rgba(241,230,204,0.34)' };

function buildNote(piece: Piece, stave: Stave) {
  const rest = piece.midis === null;
  const duration = piece.wholeBarRest ? 'w' : WRITABLE[piece.ticks];
  const note = new StaveNote({
    keys: rest ? ['b/4'] : piece.midis!.map(writtenKey),
    duration: rest ? `${duration}r` : duration,
    auto_stem: !rest,
    clef: 'treble',
  });
  if (!piece.wholeBarRest && duration.endsWith('d')) Dot.buildAndAttach([note], { all: true });
  note.setStyle(rest ? restStyle : noteStyle);
  note.setLedgerLineStyle(staveStyle);
  note.setStave(stave);
  return note;
}

/**
 * Draws the visible bars. Each bar is exactly one bar duration wide on the
 * shared time axis, and each note sits at its sixteenth's position inside the bar,
 * so noteheads line up with their onsets in the waveform.
 */
export function drawNotation(
  ctx: CanvasRenderingContext2D,
  scrollLeft: number,
  width: number,
  _height: number,
  pps: number,
  duration: number,
  tempo: Tempo & { bpm: number },
  bars: Map<number, Bar>,
) {
  const vf = new CanvasContext(ctx);
  vf.setFillStyle(palette.parchment);
  vf.setStrokeStyle(palette.parchment);

  const barDur = barDuration(tempo);
  const barW = barDur * pps;
  const barTicks = tempo.beatsPerBar * TICKS_PER_BEAT;
  const withNotes = barW >= MIN_BAR_PX;

  const t0 = scrollLeft / pps;
  const t1 = (scrollLeft + width) / pps;
  // bars that exist on the timeline: from the one containing 0 s to the one containing the end
  const minBar = Math.floor((0 - tempo.downbeat) / barDur);
  const maxBar = Math.floor((duration - tempo.downbeat) / barDur);
  const first = Math.max(minBar, Math.floor((t0 - tempo.downbeat) / barDur));
  const last = Math.min(maxBar, Math.floor((t1 - tempo.downbeat) / barDur));

  const drawn: { piece: Piece; note: StaveNote }[] = [];

  ctx.font = "500 10px 'Instrument Sans Variable', system-ui, sans-serif";
  ctx.textBaseline = 'alphabetic';

  for (let index = first; index <= last; index++) {
    const x0 = barStart(tempo, index) * pps - scrollLeft;
    const stave = new Stave(x0, STAVE_Y, barW);
    stave.setStyle(staveStyle);
    stave.setContext(vf).draw();

    if (index >= 0 && barW >= 28) {
      ctx.fillStyle = palette.parchmentFaint;
      ctx.fillText(String(index + 1), x0 + 3, STAVE_Y + 30);
    }

    const bar = bars.get(index);
    if (!bar || !withNotes) continue;

    const notes = bar.pieces.map((piece) => buildNote(piece, stave));
    const voice = new Voice({ num_beats: tempo.beatsPerBar, beat_value: 4 })
      .setMode(Voice.Mode.SOFT)
      .addTickables(notes);
    Accidental.applyAccidentals([voice], 'C');

    const noteStart = stave.getNoteStartX();
    bar.pieces.forEach((piece, i) => {
      const x = piece.wholeBarRest
        ? x0 + barW / 2 - 6
        : x0 + BAR_PAD + (piece.tick / barTicks) * (barW - BAR_PAD);
      const tc = new TickContext();
      tc.addTickable(notes[i]).preFormat();
      tc.setX(x - noteStart);
      // VexFlow adds its own padding; shift so the notehead starts exactly at x
      tc.setX(tc.getX() + x - notes[i].getNoteHeadBeginX());
    });

    const beams = Beam.generateBeams(
      notes.filter((n) => !n.isRest()),
      { maintain_stem_directions: false },
    );
    for (const n of notes) n.setContext(vf).draw();
    for (const b of beams) b.setStyle(noteStyle).setContext(vf).draw();

    bar.pieces.forEach((piece, i) => {
      drawn.push({ piece, note: notes[i] });
      if (piece.ring) {
        const xOf = (tick: number) => x0 + BAR_PAD + (tick / barTicks) * (barW - BAR_PAD);
        drawLetRing(ctx, notes[i], piece, xOf);
      }
    });
  }

  // ties, including those across bar lines (only when both ends are visible)
  for (let i = 0; i + 1 < drawn.length; i++) {
    const { piece, note } = drawn[i];
    if (!piece.tie) continue;
    const next = drawn[i + 1];
    if (next.piece.midis === null) continue;
    const indices = piece.midis!.map((_, k) => k);
    new StaveTie({
      first_note: note,
      last_note: next.note,
      first_indices: indices,
      last_indices: indices,
    })
      .setStyle(noteStyle)
      .setContext(vf)
      .draw();
  }

  // clef and time signature stay pinned at the left edge, like a DAW's track header
  const grad = ctx.createLinearGradient(0, 0, CLEF_PANEL_W + 14, 0);
  grad.addColorStop(0, 'rgba(28,19,13,0.94)');
  grad.addColorStop(0.8, 'rgba(28,19,13,0.88)');
  grad.addColorStop(1, 'rgba(28,19,13,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CLEF_PANEL_W + 14, _height);
  const head = new Stave(0, STAVE_Y, CLEF_PANEL_W);
  head.setStyle({ fillStyle: palette.parchmentMuted, strokeStyle: staveStyle.strokeStyle });
  head.setBegBarType(BarlineType.SINGLE).setEndBarType(BarlineType.NONE);
  const glyphStyle = { fillStyle: palette.parchmentMuted, strokeStyle: palette.parchmentMuted };
  head.addModifier(new Clef('treble', 'default', '8vb').setStyle(glyphStyle));
  head.addModifier(new TimeSignature(`${tempo.beatsPerBar}/4`).setStyle(glyphStyle));
  head.setContext(vf).draw();
}

/**
 * Let ring (l.v.): an open tie from each notehead that keeps sounding, running on
 * the time axis to where the note stops, so sustain over later notes stays visible.
 */
function drawLetRing(
  ctx: CanvasRenderingContext2D,
  note: StaveNote,
  piece: Piece,
  xOf: (tick: number) => number,
) {
  const ys = note.getYs();
  const below = note.getStemDirection() === 1; // stem up -> arc under the noteheads
  const dir = below ? 1 : -1;
  const xs = note.getNoteHeadEndX() + 2;
  ctx.fillStyle = palette.parchmentMuted;
  piece.ring!.forEach((ring, k) => {
    if (ring <= 0) return;
    const xe = xOf(piece.tick + piece.ticks + ring) - 2;
    if (xe - xs < 6) return;
    const y = ys[k] + dir * 4;
    const mid = (xs + xe) / 2;
    const lift = Math.min(7, 2.5 + (xe - xs) * 0.04);
    ctx.beginPath();
    ctx.moveTo(xs, y);
    ctx.quadraticCurveTo(mid, y + dir * lift, xe, y);
    ctx.quadraticCurveTo(mid, y + dir * (lift - 1.6), xs, y);
    ctx.fill();
  });
}
