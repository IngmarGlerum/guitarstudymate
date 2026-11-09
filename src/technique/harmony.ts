import { chordType, fitWarning, type ChordTypeId } from './chords';
import { LIBRARY, libraryEntry } from './library';
import type { Segment } from './progressions';
import { pcName } from './theory';

/**
 * Harmony of a progression: its key, the units a route is chosen for (a ii–V(–I)
 * is one unit, R-6) and the routes per unit in three layers (R-3, R-4).
 */

export interface Key {
  pc: number;
  minor: boolean;
}

const MAJOR_SET = [0, 2, 4, 5, 7, 9, 11];
/** a minor key counts its harmonic form, so V7 with its leading tone is "in the key" */
const MINOR_SET = [0, 2, 3, 5, 7, 8, 11];

export const keySet = (k: Key) => new Set((k.minor ? MINOR_SET : MAJOR_SET).map((x) => (x + k.pc) % 12));

export function keyName(k: Key, flats = false) {
  return `${pcName(k.pc, flats)} ${k.minor ? 'mineur' : 'majeur'}`;
}

const MINORISH: ChordTypeId[] = ['m7', 'm6', 'mMaj7', 'm7b5'];
const DOMINANT: ChordTypeId[] = ['7', '7b9', '7#11', '7#5', '7alt', '7sus4'];
const TONIC_MAJOR: ChordTypeId[] = ['maj7', '6', 'maj7#11'];
const TONIC_MINOR: ChordTypeId[] = ['m6', 'mMaj7', 'm7'];

const tonesOf = (seg: Segment) => chordType(seg.chord.type).intervals.map((i) => (i + seg.chord.rootPc) % 12);

/** The key whose scale holds the most chord tones, with a bonus for tonic chords (P-7). */
export function detectKey(segs: Segment[]): Key {
  let best: Key = { pc: 0, minor: false };
  let bestScore = -Infinity;
  for (let pc = 0; pc < 12; pc++) {
    for (const minor of [false, true]) {
      const k = { pc, minor };
      const set = keySet(k);
      let score = 0;
      segs.forEach((s, i) => {
        const inKey = tonesOf(s).filter((t) => set.has(t)).length;
        score += inKey * s.beats;
        const tonic = s.chord.rootPc === pc && (minor ? TONIC_MINOR : TONIC_MAJOR).includes(s.chord.type);
        if (tonic) score += 3 * s.beats + (i === segs.length - 1 || i === 0 ? 4 : 0);
        // a form usually starts on its tonic, even a dominant one (blues): weigh the first bar's root
        if (i === 0 && s.chord.rootPc === pc && minor === MINORISH.includes(s.chord.type)) score += 6 * s.beats;
      });
      if (score > bestScore) {
        bestScore = score;
        best = k;
      }
    }
  }
  return best;
}

export interface Unit {
  id: string;
  kind: 'iiVI' | 'iiV' | 'single';
  /** indexes into the segment list */
  segs: number[];
  /** local key: a ii–V(–I) is its own mini key */
  key: Key;
}

/** Find ii–V(–I) cadences; everything else is a single-chord unit (R-6). */
export function findUnits(segs: Segment[], global: Key): Unit[] {
  const units: Unit[] = [];
  let i = 0;
  while (i < segs.length) {
    const a = segs[i];
    const b = segs[i + 1];
    const c = segs[i + 2];
    const isII = MINORISH.includes(a.chord.type) && a.chord.type !== 'm6' && a.chord.type !== 'mMaj7';
    const isV = b && DOMINANT.includes(b.chord.type) && (a.chord.rootPc + 5) % 12 === b.chord.rootPc;
    if (isII && isV) {
      const iRoot = (b.chord.rootPc + 5) % 12;
      const hasI = c && c.chord.rootPc === iRoot && [...TONIC_MAJOR, ...TONIC_MINOR].includes(c.chord.type);
      // minor when it resolves to a minor chord, or when the ii is half-diminished
      const minor = hasI ? TONIC_MINOR.includes(c.chord.type) : a.chord.type === 'm7b5';
      const key: Key = { pc: iRoot, minor: minor || a.chord.type === 'm7b5' };
      units.push({ id: `u${i}`, kind: hasI ? 'iiVI' : 'iiV', segs: hasI ? [i, i + 1, i + 2] : [i, i + 1], key });
      i += hasI ? 3 : 2;
      continue;
    }
    // a lone chord that fits the key of the cadence before it belongs to that key
    const prev = units[units.length - 1];
    const local = prev && prev.kind !== 'single' && tonesOf(a).every((t) => keySet(prev.key).has(t)) ? prev.key : global;
    units.push({ id: `u${i}`, kind: 'single', segs: [i], key: local });
    i += 1;
  }
  return units;
}

export type Layer = 'inKey' | 'common' | 'adventurous';
export const LAYER_LABEL: Record<Layer, string> = {
  inKey: 'Binnen toonsoort',
  common: 'Gangbare kleuren',
  adventurous: 'Avontuurlijk',
};
const LAYER_RANK: Record<Layer, number> = { inKey: 0, common: 1, adventurous: 2 };
export const layerAllowed = (layer: Layer, upTo: Layer) => LAYER_RANK[layer] <= LAYER_RANK[upTo];

export interface RouteStep {
  scaleId: string;
  /** semitones between the chord root and the scale's root (R-1 with offset) */
  offset: number;
}

export interface Route {
  id: string;
  steps: RouteStep[];
  layer: Layer;
  /** why an unusual choice is still common practice */
  note?: string;
  /** "vrij" combinations would be marked; all offered routes here are tested ones */
  warnings: string[];
}

const step = (scaleId: string, offset = 0): RouteStep => ({ scaleId, offset });

/** Common scales per chord type, from the requirements' table (R-3). */
const COMMON: Record<ChordTypeId, string[]> = {
  m7: ['dorian'],
  m6: ['melodic-minor', 'dorian'],
  mMaj7: ['melodic-minor', 'harmonic-minor'],
  m7b5: ['locrian-nat2', 'locrian'],
  maj7: ['ionian', 'lydian'],
  '6': ['ionian', 'penta-major'],
  'maj7#11': ['lydian'],
  '7': ['mixolydian', 'lydian-dominant', 'octatonic-hw', 'altered', 'whole-tone'],
  '7sus4': ['mixolydian', 'dorian'],
  '7b9': ['phrygian-dominant', 'octatonic-hw', 'altered'],
  '7#11': ['lydian-dominant'],
  '7#5': ['whole-tone', 'altered'],
  '7alt': ['altered'],
  dim7: ['octatonic-wh'],
};

/** Adventurous but known moves on a dominant, with their story (section 6). */
const DOMINANT_SPECIALS: { step: RouteStep; note: string }[] = [
  { step: step('penta-minor', 3), note: 'Mineurpentatoniek een kleine terts boven de grondtoon: klinkt gealtereerd.' },
  { step: step('penta-minor6', 1), note: 'Mineur-6-pentatoniek een halve toon boven de grondtoon (Brecker-stijl, Fm6 op E7alt).' },
];

/** Tested combinations per cadence (R-6), from the requirements' table. */
const CADENCE_ROUTES: Record<'major' | 'minor', { steps: RouteStep[]; note?: string; adventurous?: boolean }[]> = {
  major: [
    { steps: [step('dorian'), step('mixolydian'), step('ionian')] },
    { steps: [step('dorian'), step('altered'), step('ionian')] },
    { steps: [step('dorian'), step('lydian-dominant'), step('ionian')] },
    { steps: [step('dorian'), step('octatonic-hw'), step('ionian')] },
    { steps: [step('dorian'), step('whole-tone'), step('ionian')] },
    { steps: [step('dorian'), step('penta-minor', 3), step('ionian')], note: DOMINANT_SPECIALS[0].note, adventurous: true },
    { steps: [step('dorian'), step('penta-minor6', 1), step('ionian')], note: DOMINANT_SPECIALS[1].note, adventurous: true },
  ],
  minor: [
    { steps: [step('locrian-nat2'), step('altered'), step('melodic-minor')] },
    { steps: [step('locrian'), step('phrygian-dominant'), step('harmonic-minor')], note: 'Traditioneler: frygisch dominant in plaats van gealtereerd.' },
    { steps: [step('locrian-nat2'), step('phrygian-dominant'), step('harmonic-minor')] },
    { steps: [step('locrian-nat2'), step('octatonic-hw'), step('melodic-minor')] },
    { steps: [step('locrian-nat2'), step('penta-minor', 3), step('melodic-minor')], note: DOMINANT_SPECIALS[0].note, adventurous: true },
  ],
};

function pcsOf(st: RouteStep, chordRoot: number) {
  const e = libraryEntry(st.scaleId);
  return (e?.intervals ?? []).map((i) => (i + chordRoot + st.offset) % 12);
}

const outside = (st: RouteStep, seg: Segment, k: Key) => {
  const set = keySet(k);
  return pcsOf(st, seg.chord.rootPc).filter((p) => !set.has(p)).length;
};

function warningsFor(steps: RouteStep[], segs: Segment[]) {
  const out: string[] = [];
  steps.forEach((st, i) => {
    const seg = segs[i];
    const e = libraryEntry(st.scaleId);
    if (!e || !seg) return;
    const w = fitWarning(e.intervals, chordType(seg.chord.type), st.offset);
    if (w) out.push(`${seg.text}: ${w}`);
  });
  return out;
}

/** All routes for a unit, layered and with warnings (R-3, R-5). */
export function routesFor(unit: Unit, allSegs: Segment[]): Route[] {
  const segs = unit.segs.map((i) => allSegs[i]);
  const routes: Route[] = [];
  const add = (steps: RouteStep[], layer: Layer, note?: string) => {
    const id = steps.map((s) => `${s.scaleId}${s.offset ? `@${s.offset}` : ''}`).join('/');
    if (routes.some((r) => r.id === id)) return;
    routes.push({ id, steps, layer, note, warnings: warningsFor(steps, segs) });
  };

  if (unit.kind !== 'single') {
    const table = CADENCE_ROUTES[unit.key.minor ? 'minor' : 'major'];
    for (const r of table) {
      let steps = r.steps.slice(0, segs.length);
      if (unit.key.minor) {
        // a minor ii–V with m7 chords: dorian instead of locrian on the ii, dorian or aeolian on the i
        steps = steps.map((st, i) => {
          const t = segs[i].chord.type;
          if (i === 0 && t === 'm7') return step('dorian');
          if (i === 2 && t === 'm7') return step(st.scaleId === 'harmonic-minor' ? 'aeolian' : 'dorian');
          return st;
        });
      }
      const inKey = steps.every((st, i) => outside(st, segs[i], unit.key) === 0);
      add(steps, r.adventurous ? 'adventurous' : inKey ? 'inKey' : 'common', r.note);
    }
    // R-7: at most one tension-rich scale per cadence (the table already respects it)
    return routes;
  }

  const seg = segs[0];
  const type = seg.chord.type;
  for (const e of LIBRARY_SCALES()) {
    const st = step(e.id);
    const w = fitWarning(e.intervals, chordType(type));
    const common = COMMON[type]?.includes(e.id);
    const inKey = outside(st, seg, unit.key) === 0;
    if (w && !common) continue; // only fitting scales, plus the common ones even if they warn
    add([st], inKey && (common || !w) ? 'inKey' : common ? 'common' : 'adventurous');
  }
  if (DOMINANT.includes(type)) for (const s of DOMINANT_SPECIALS) add([s.step], 'adventurous', s.note);
  const rank = (r: Route) => LAYER_RANK[r.layer] * 100 + (COMMON[type]?.indexOf(r.steps[0].scaleId) ?? 50);
  return routes.sort((a, b) => rank(a) - rank(b));
}

const LIBRARY_SCALES = () => LIBRARY.filter((e) => e.kind === 'scale');

export function routeLabel(r: Route, segs: Segment[], unit: Unit) {
  return r.steps
    .map((st, i) => {
      const e = libraryEntry(st.scaleId);
      const name = e?.label.replace(/ \(.*\)$/, '') ?? st.scaleId;
      if (!st.offset) return name;
      const seg = segs[unit.segs[i]];
      // a root a minor third or half step above reads as a flat (B♭ over G7, not A♯)
      return `${pcName((seg.chord.rootPc + st.offset) % 12, true)} ${name.toLowerCase()}`;
    })
    .join(' – ');
}
