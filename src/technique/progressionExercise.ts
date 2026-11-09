import { chordType } from './chords';
import {
  shorten,
  stepMidi,
  stepScalePcs,
  type EnclosureForm,
  type EncRhythm,
  type FillMode,
} from './enclosures';
import { applyPattern } from './exercise';
import type { FretNote } from './fingering';
import { boxNotes, followWindow, pickTarget, targetPcs, WINDOW_SPAN, type ScaleChoice, type TargetMode } from './fretWindow';
import { MAX_FRET, TUNING } from './theory';
import { findUnits, layerAllowed, routesFor, detectKey, type Key, type Layer, type Route, type Unit } from './harmony';
import type { Segment } from './progressions';

export type ProgressionContent = 'targets' | 'scale' | 'enclosures';
export type RouteOrder = 'sequence' | 'random';

export interface ProgressionPlan {
  segs: Segment[];
  key: Key;
  units: Unit[];
  routes: Map<string, Route[]>;
}

/** Stable key for a unit, so the user's route checkboxes survive small edits. */
export const unitKey = (u: Unit, segs: Segment[]) => `${u.segs[0]}:${u.segs.map((i) => segs[i].text).join(' ')}`;

export function planProgression(segs: Segment[], keyOverride: Key | null): ProgressionPlan {
  const key = keyOverride ?? detectKey(segs);
  const units = findUnits(segs, key);
  const routes = new Map(units.map((u) => [u.id, routesFor(u, segs)]));
  return { segs, key, units, routes };
}

/** Routes a unit may use: within the switch's layer and not unticked (R-4). */
export function poolFor(plan: ProgressionPlan, u: Unit, upTo: Layer, off: Record<string, string[]>) {
  const unticked = new Set(off[unitKey(u, plan.segs)] ?? []);
  const all = plan.routes.get(u.id) ?? [];
  const pool = all.filter((r) => layerAllowed(r.layer, upTo) && !unticked.has(r.id));
  // never leave a unit empty: fall back to its first (safest) route
  return pool.length ? pool : all.slice(0, 1);
}

/** deterministic "random" per pass and unit, so screen and sound agree */
function pick<T>(list: T[], pass: number, salt: number, order: RouteOrder): T {
  if (order === 'sequence') return list[pass % list.length];
  let s = ((pass + 1) * 2654435761 + salt * 40503) >>> 0;
  s = (s * 1664525 + 1013904223) >>> 0;
  return list[s % list.length];
}

/** One scale per segment for pass `pass`: each unit plays one route from its pool. */
export function choicesForPass(
  plan: ProgressionPlan,
  upTo: Layer,
  off: Record<string, string[]>,
  order: RouteOrder,
  pass: number,
): { choices: ScaleChoice[]; routeIds: Map<string, string> } {
  const choices: ScaleChoice[] = [];
  const routeIds = new Map<string, string>();
  plan.units.forEach((u, ui) => {
    const route = pick(poolFor(plan, u, upTo, off), pass, ui, order);
    routeIds.set(u.id, route.id);
    u.segs.forEach((segIndex, i) => {
      choices[segIndex] = route.steps[i] ?? route.steps[route.steps.length - 1];
    });
  });
  return { choices, routeIds };
}

export interface PassOptions {
  subdivision: number;
  content: ProgressionContent;
  targetMode: TargetMode;
  windowLo: number;
  follow: boolean;
  direction: 'up' | 'down' | 'updown';
  /** content 'enclosures' only */
  enclosure?: EnclosureOptions;
}

export interface EnclosureOptions {
  forms: EnclosureForm[];
  order: RouteOrder;
  rhythm: EncRhythm;
  fill: FillMode;
  pattern: number[];
  /** which repeat this is: forms rotate per target note over the repeats (O-6) */
  pass: number;
  /** the first target of the next repeat: the notes at the end of this one lead to it */
  wrapTarget: FretNote | null;
}

/** an approach note that falls on a beat but is no chord tone (bebop check) */
export interface BeatIssue {
  slot: number;
  midi: number;
  seg: number;
}

export interface ProgressionPass {
  slots: (FretNote | null)[];
  /** which segment each slot belongs to */
  segOfSlot: number[];
  /** window (lowest fret) and box notes per segment, for the neck */
  windows: number[];
  boxes: FretNote[][];
  /** the target per segment (null if the window has none) */
  targets: (FretNote | null)[];
  beatIssues: BeatIssue[];
}

/**
 * Notes for one pass. Every chord starts with its target on its first beat
 * (O-4/O-5); after it either rests ("doelnoten") or runs through the route's
 * scale from the target inside the window ("ladder per akkoord").
 */
export function buildProgressionPass(segs: Segment[], choices: ScaleChoice[], o: PassOptions): ProgressionPass {
  if (o.content === 'enclosures' && o.enclosure) return buildEnclosurePass(segs, choices, o, o.enclosure);
  const slots: (FretNote | null)[] = [];
  const segOfSlot: number[] = [];
  const windows: number[] = [];
  const boxes: FretNote[][] = [];
  const targetList: (FretNote | null)[] = [];
  let lo = o.windowLo;
  let prev: number | null = null;
  let dir = o.direction === 'down' ? -1 : 1;

  segs.forEach((seg, si) => {
    const choice = choices[si] ?? { scaleId: 'ionian', offset: 0 };
    const targets = targetPcs(seg.chord, o.targetMode);
    if (o.follow && si > 0) lo = followWindow(choice, seg.chord, targets, lo, prev);
    let box = boxNotes(choice, seg.chord, lo);
    let target = pickTarget(box, targets, prev);
    // a fixed window without the target: widen it by a fret each side (V-1)
    if (!target) {
      box = boxNotes(choice, seg.chord, Math.max(0, lo - 1), 6);
      target = pickTarget(box, targets, prev);
    }
    windows.push(lo);
    boxes.push(box);
    targetList.push(target);
    const count = Math.round(seg.beats * o.subdivision);
    let idx = target ? box.indexOf(target) : 0;
    for (let k = 0; k < count; k++) {
      segOfSlot.push(si);
      if (k === 0) {
        slots.push(target ? { ...target, role: 'target' } : null);
        if (target) prev = target.midi;
        continue;
      }
      if (o.content === 'targets' || !box.length) {
        slots.push(null);
        continue;
      }
      // step through the scale, turning round at the edges of the window
      if (idx + dir < 0 || idx + dir >= box.length) dir = -dir;
      if (o.direction === 'down' && k === 1 && idx === 0) dir = 1;
      idx = Math.max(0, Math.min(box.length - 1, idx + dir));
      slots.push(box[idx]);
      prev = box[idx].midi;
    }
    if (o.direction === 'updown') dir = -dir; // alternate the run's direction per chord
    else dir = o.direction === 'down' ? -1 : 1;
  });
  return { slots, segOfSlot, windows, boxes, targets: targetList, beatIssues: [] };
}

/** Windows, boxes and targets per segment, the target of each chord led from the previous one. */
export function targetsOf(segs: Segment[], choices: ScaleChoice[], o: PassOptions) {
  const windows: number[] = [];
  const boxes: FretNote[][] = [];
  const targets: (FretNote | null)[] = [];
  let lo = o.windowLo;
  let prev: number | null = null;
  segs.forEach((seg, si) => {
    const choice = choices[si] ?? { scaleId: 'ionian', offset: 0 };
    const tpcs = targetPcs(seg.chord, o.targetMode);
    if (o.follow && si > 0) lo = followWindow(choice, seg.chord, tpcs, lo, prev);
    let box = boxNotes(choice, seg.chord, lo);
    let target = pickTarget(box, tpcs, prev);
    if (!target) {
      box = boxNotes(choice, seg.chord, Math.max(0, lo - 1), 6);
      target = pickTarget(box, tpcs, prev);
    }
    windows.push(lo);
    boxes.push(box);
    targets.push(target);
    if (target) prev = target.midi;
  });
  return { windows, boxes, targets };
}

/** slots per segment and where each starts */
function grid(segs: Segment[], subdivision: number) {
  const counts = segs.map((s) => Math.max(1, Math.round(s.beats * subdivision)));
  const starts: number[] = [];
  let t = 0;
  for (const c of counts) {
    starts.push(t);
    t += c;
  }
  return { counts, starts, total: t };
}

/**
 * Room for an enclosure before each chord: the previous chord's slots minus the
 * one its own target takes. The approach to the first chord sits at the end of
 * the repeat (the progression loops).
 */
export function enclosureRoom(segs: Segment[], subdivision: number) {
  if (!segs.length) return Infinity;
  const { counts } = grid(segs, subdivision);
  return Math.min(...counts.map((_, i) => counts[(i - 1 + counts.length) % counts.length] - 1));
}

/** the longest form: the notes it needs before its target */
export const enclosureNeed = (forms: EnclosureForm[]) => Math.max(0, ...forms.map((f) => f.steps.length));

export function enclosureFits(segs: Segment[], forms: EnclosureForm[], subdivision: number) {
  return enclosureNeed(forms) <= enclosureRoom(segs, subdivision);
}

/** The place for an approach note: near the target's string, inside or just outside the window. */
function placeNear(midi: number, ref: FretNote, lo: number): FretNote | null {
  let best: FretNote | null = null;
  let bestCost = Infinity;
  for (let s = 0; s < TUNING.length; s++) {
    const fret = midi - TUNING[s];
    if (fret < 0 || fret > MAX_FRET) continue;
    const outside = Math.max(0, lo - 1 - fret, fret - (lo + WINDOW_SPAN + 1));
    const cost = Math.abs(s - ref.string) + outside * 2 + Math.abs(fret - ref.fret) * 0.3;
    if (cost < bestCost) {
      bestCost = cost;
      best = { midi, string: s, fret, degree: 0, role: 'approach' };
    }
  }
  return best;
}

/**
 * Enclosure exercise (phase 3): each target arrives on the first beat of its chord
 * (or a slot early/late for anticipation/suspension), preceded by the steps of a
 * form. Diatonic steps use the scale that sounds when they are played. What is
 * left is a rest, or for advanced players a scale, arpeggio or pattern fill.
 */
function buildEnclosurePass(
  segs: Segment[],
  choices: ScaleChoice[],
  o: PassOptions,
  e: EnclosureOptions,
): ProgressionPass {
  const { windows, boxes, targets } = targetsOf(segs, choices, o);
  const { counts, starts, total } = grid(segs, o.subdivision);
  const n = segs.length;
  const slots: (FretNote | null)[] = new Array(total).fill(null);
  const segOfSlot: number[] = [];
  counts.forEach((c, i) => {
    for (let k = 0; k < c; k++) segOfSlot.push(i);
  });
  const wrap = (p: number) => ((p % total) + total) % total;
  const shift = e.rhythm === 'anticipation' ? -1 : e.rhythm === 'suspension' ? 1 : 0;
  const arrival = (i: number) => starts[i] + shift;
  // notes that land beyond the end of the repeat lead into the next repeat's first target
  const targetFor = (i: number, pos: number) => (i === 0 && pos < 0 && e.wrapTarget ? e.wrapTarget : targets[i]);
  const choice = (si: number) => choices[si] ?? { scaleId: 'ionian', offset: 0 };
  const beatIssues: BeatIssue[] = [];

  // one enclosure: `keep` decides which raw positions belong to this repeat
  const enclose = (i: number, target: FretNote, pass: number, keep: (raw: number) => boolean) => {
    if (!e.forms.length) return;
    const seg = segs[i];
    const at = arrival(i);
    const form = pickForm(e.forms, pass, i, n, e.order);
    const room = counts[(i - 1 + n) % n] - 1;
    const midisAt = (steps: typeof form.steps) => {
      const list = steps
        .map((st, k) => {
          // the scale that sounds where this step will be played
          const si = segOfSlot[wrap(at - steps.length + k)];
          const pcs = stepScalePcs(form, { choice: choice(si), chord: segs[si].chord }, seg.chord);
          return { step: st, midi: stepMidi(st, target.midi, pcs) };
        })
        // a diatonic half step equals the chromatic one: play it once
        .filter((x, k, a) => x.midi !== target.midi && (k === 0 || x.midi !== a[k - 1].midi));
      return list.map((x, k) => ({ ...x, raw: at - list.length + k }));
    };
    let notes = midisAt(form.steps);
    if (notes.length > room) {
      // make it shorter: keep the steps nearest the target
      const kept = new Set(shorten(notes, target.midi, room).map((x) => x.step));
      notes = midisAt(form.steps.filter((st) => kept.has(st)));
    }
    for (const nt of notes) {
      if (!keep(nt.raw)) continue;
      const pos = wrap(nt.raw);
      const placed = placeNear(nt.midi, target, windows[i]);
      if (!placed || slots[pos]) continue;
      slots[pos] = placed;
      if (form.beatCheck && pos % o.subdivision === 0) {
        const si = segOfSlot[pos];
        const ct = chordType(segs[si].chord.type).intervals.map((x) => (x + segs[si].chord.rootPc) % 12);
        if (!ct.includes(nt.midi % 12)) beatIssues.push({ slot: pos, midi: nt.midi, seg: si });
      }
    }
  };

  segs.forEach((_, i) => {
    const at = arrival(i);
    const target = targetFor(i, at);
    if (target) slots[wrap(at)] = { ...target, role: 'target' };
  });
  segs.forEach((_, i) => {
    const t = targets[i];
    if (i > 0) {
      if (t) enclose(i, t, e.pass, () => true);
      return;
    }
    // the first chord: notes before the start of the repeat sit at its end and lead
    // into the next repeat's first target; notes from beat 1 on lead to this one
    const next = e.wrapTarget ?? t;
    if (next) enclose(0, next, e.pass + 1, (raw) => raw < 0);
    if (t) enclose(0, t, e.pass, (raw) => raw >= 0);
  });

  if (e.fill !== 'rest') {
    segs.forEach((seg, i) => {
      const at = arrival(i);
      const target = targetFor(i, at);
      const box = boxes[i];
      if (!target || !box.length) return;
      const line = fillLine(e.fill, box, target, seg.chord, o.direction, e.pattern, i);
      let k = 0;
      for (let p = wrap(at + 1); slots[p] === null && k < total; p = wrap(p + 1)) {
        slots[p] = line(k++);
      }
    });
  }
  return { slots, segOfSlot, windows, boxes, targets, beatIssues };
}

function pickForm(forms: EnclosureForm[], pass: number, i: number, n: number, order: RouteOrder) {
  const g = pass * n + i;
  if (order === 'sequence') return forms[g % forms.length];
  let s = ((g + 1) * 2654435761) >>> 0;
  s = (s * 1664525 + 1013904223) >>> 0;
  return forms[s % forms.length];
}

/** The fill after a target: k-th note of a scale run, an arpeggio or a pattern, inside the window. */
function fillLine(
  mode: FillMode,
  box: FretNote[],
  target: FretNote,
  chord: Segment['chord'],
  direction: PassOptions['direction'],
  pattern: number[],
  segIndex: number,
): (k: number) => FretNote {
  let list = box;
  if (mode === 'arpeggio') {
    const tones = new Set(chordType(chord.type).intervals.map((x) => (x + chord.rootPc) % 12));
    const arp = box.filter((nt) => tones.has(nt.midi % 12));
    if (arp.length > 1) list = arp;
  }
  const nearest = list.reduce((b, nt, j) => (Math.abs(nt.midi - target.midi) < Math.abs(list[b].midi - target.midi) ? j : b), 0);
  if (mode === 'pattern') {
    const up = applyPattern(list.slice(nearest), pattern);
    const seq = up.length ? up : applyPattern(list, pattern);
    if (seq.length) {
      const body = seq[0].midi === target.midi ? seq.slice(1) : seq;
      const cycle = body.length ? body : seq;
      return (k) => cycle[k % cycle.length];
    }
  }
  // a run that turns round at the edges of the window; up/down alternate per chord
  let dir = direction === 'down' || (direction === 'updown' && segIndex % 2 === 1) ? -1 : 1;
  let idx = nearest;
  const notes: FretNote[] = [];
  return (k) => {
    while (notes.length <= k) {
      if (list.length < 2) {
        notes.push(list[0]);
        continue;
      }
      if (idx + dir < 0 || idx + dir >= list.length) dir = -dir;
      idx += dir;
      notes.push(list[idx]);
    }
    return notes[k];
  };
}
