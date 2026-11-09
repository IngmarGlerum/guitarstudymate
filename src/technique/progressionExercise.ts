import type { FretNote } from './fingering';
import { boxNotes, followWindow, pickTarget, targetPcs, type ScaleChoice, type TargetMode } from './fretWindow';
import { findUnits, layerAllowed, routesFor, detectKey, type Key, type Layer, type Route, type Unit } from './harmony';
import type { Segment } from './progressions';

export type ProgressionContent = 'targets' | 'scale';
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
}

export interface ProgressionPass {
  slots: (FretNote | null)[];
  /** which segment each slot belongs to */
  segOfSlot: number[];
  /** window (lowest fret) and box notes per segment, for the neck */
  windows: number[];
  boxes: FretNote[][];
}

/**
 * Notes for one pass. Every chord starts with its target on its first beat
 * (O-4/O-5); after it either rests ("doelnoten") or runs through the route's
 * scale from the target inside the window ("ladder per akkoord").
 */
export function buildProgressionPass(segs: Segment[], choices: ScaleChoice[], o: PassOptions): ProgressionPass {
  const slots: (FretNote | null)[] = [];
  const segOfSlot: number[] = [];
  const windows: number[] = [];
  const boxes: FretNote[][] = [];
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
  return { slots, segOfSlot, windows, boxes };
}
