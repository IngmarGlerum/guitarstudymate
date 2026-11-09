import { chordType, type Chord } from './chords';
import { libraryEntry } from './library';
import { pcName } from './theory';
import { scalePcs, type ScaleChoice } from './fretWindow';

/**
 * Enclosures (omspelingen), requirements section 5. A form is a list of steps
 * towards a target note (O-1): each step lies `dist` away from the target, in
 * semitones (chromatic) or in steps of a scale (diatonic). Rhythm and arrival are
 * separate settings (O-2), so every form works with every rhythm.
 */

export type StepType = 'chromatic' | 'diatonic';

export interface EncStep {
  /** + above the target, − below; semitones or scale steps */
  dist: number;
  type: StepType;
}

/**
 * Which scale the diatonic steps use:
 * - 'current': the ladder that sounds at that moment (before a chord change: the previous chord's)
 * - 'bebop': that ladder plus the bebop passing note of the sounding chord
 * - a fixed scale on the dominant of the target chord (altered, whole tone, half–whole)
 */
export type EncScale = 'current' | 'bebop' | { scaleId: string; on: 'dominant' };

export interface EnclosureForm {
  id: string;
  label: string;
  /** groups of the requirements: 1 single note … 5 scales with tension */
  group: 1 | 2 | 3 | 4 | 5;
  /** step in leerlijn A (levels 1–5 here; 0 = target notes only) */
  level: number;
  steps: EncStep[];
  scale?: EncScale;
  /** check that chord tones fall on the beat (bebop) */
  beatCheck?: boolean;
  /** shown instead of a computed example */
  example?: string;
}

const c = (dist: number): EncStep => ({ dist, type: 'chromatic' });
const d = (dist: number): EncStep => ({ dist, type: 'diatonic' });

export const GROUP_LABEL: Record<EnclosureForm['group'], string> = {
  1: 'Eén noot',
  2: 'Van twee kanten',
  3: 'Langere lijnen',
  4: 'Vanuit een akkoord',
  5: 'Ladders met spanning',
};

export const ENCLOSURES: EnclosureForm[] = [
  { id: 'c-below', label: 'Chromatisch van onder', group: 1, level: 1, steps: [c(-1)] },
  { id: 'c-above', label: 'Chromatisch van boven', group: 1, level: 1, steps: [c(1)] },
  { id: 'd-below', label: 'Diatonisch van onder', group: 1, level: 2, steps: [d(-1)] },
  { id: 'd-above', label: 'Diatonisch van boven', group: 1, level: 2, steps: [d(1)] },

  { id: 'da-cb', label: 'Diatonisch boven, chromatisch onder', group: 2, level: 3, steps: [d(1), c(-1)] },
  { id: 'ca-cb', label: 'Chromatisch boven, chromatisch onder', group: 2, level: 3, steps: [c(1), c(-1)] },
  { id: 'da-db', label: 'Diatonisch boven, diatonisch onder', group: 2, level: 3, steps: [d(1), d(-1)] },
  { id: 'cb-da', label: 'Chromatisch onder, diatonisch boven', group: 2, level: 3, steps: [c(-1), d(1)] },
  { id: 'cb-ca', label: 'Chromatisch onder, chromatisch boven', group: 2, level: 3, steps: [c(-1), c(1)] },
  { id: 'db-da', label: 'Diatonisch onder, diatonisch boven', group: 2, level: 3, steps: [d(-1), d(1)] },

  { id: 'two-above', label: 'Twee van boven, één van onder', group: 3, level: 4, steps: [d(1), c(1), c(-1)] },
  { id: 'two-below', label: 'Twee van onder, één van boven', group: 3, level: 4, steps: [d(-1), c(-1), d(1)] },
  { id: 'c-run-below', label: 'Chromatische loop van onder', group: 3, level: 4, steps: [c(-3), c(-2), c(-1)] },
  { id: 'c-run-above', label: 'Chromatische loop van boven', group: 3, level: 4, steps: [c(3), c(2), c(1)] },
  { id: 'd-run-below', label: 'Ladderloop van onder', group: 3, level: 4, steps: [d(-3), d(-2), d(-1)] },
  { id: 'd-run-above', label: 'Ladderloop van boven', group: 3, level: 4, steps: [d(3), d(2), d(1)] },

  // chord-based: fixed distances, so they are chromatic steps (examples for target D)
  { id: 'dom-arp', label: 'Arpeggio van de dominant van het doel', group: 4, level: 5, steps: [c(-5), c(-1), c(2)] },
  { id: 'dim7', label: 'Verminderd akkoord op de leidtoon', group: 4, level: 5, steps: [c(8), c(5), c(2), c(-1)] },
  { id: 'tritone', label: 'Tritonussubstituut', group: 4, level: 5, steps: [c(-4), c(-1), c(1)], example: 'B♭–D♭–E♭ (E♭7) → D' },

  { id: 'bebop', label: 'Bebop met doorgangsnoot', group: 5, level: 5, steps: [d(4), d(3), d(2), d(1)], scale: 'bebop', beatCheck: true, example: 'de ladder van het klinkende akkoord plus de doorgangsnoot, van boven' },
  { id: 'altered', label: 'Alterated vlak voor het doel', group: 5, level: 5, steps: [d(3), d(2), d(1)], scale: { scaleId: 'altered', on: 'dominant' }, example: 'alterated op de dominant van het doelakkoord (G7alt naar C)' },
  { id: 'whole-tone', label: 'Heletoons vlak voor het doel', group: 5, level: 5, steps: [d(3), d(2), d(1)], scale: { scaleId: 'whole-tone', on: 'dominant' }, example: 'heletoons op de dominant van het doelakkoord' },
  { id: 'half-whole', label: 'Half–heel vlak voor het doel', group: 5, level: 5, steps: [d(3), d(2), d(1)], scale: { scaleId: 'octatonic-hw', on: 'dominant' }, example: 'half–heel op de dominant van het doelakkoord' },
];

export const enclosureById = (id: string) => ENCLOSURES.find((f) => f.id === id);

/** The bebop passing note for a chord, above its root (null: none). */
function bebopPassing(chord: Chord): number | null {
  const t = chordType(chord.type);
  const has = (i: number) => t.intervals.some((x) => x % 12 === i);
  if (has(10) && has(4)) return 11; // dominant: major 7 between ♭7 and root
  if (has(3)) return 4; // minor (dorian bebop): major 3 between ♭3 and 4
  if (has(4)) return 8; // major: ♯5 between 5 and 6
  return null;
}

/** Pitch classes of the scale a form's diatonic steps walk. */
export function stepScalePcs(form: EnclosureForm, sounding: { choice: ScaleChoice; chord: Chord }, targetChord: Chord) {
  const sc = form.scale ?? 'current';
  if (sc === 'current' || sc === 'bebop') {
    const pcs = new Set(scalePcs(sounding.choice, sounding.chord).pcs);
    if (sc === 'bebop') {
      const p = bebopPassing(sounding.chord);
      if (p !== null) pcs.add((sounding.chord.rootPc + p) % 12);
    }
    return pcs;
  }
  const root = (targetChord.rootPc + 7) % 12;
  return new Set((libraryEntry(sc.scaleId)?.intervals ?? []).map((i) => (i + root) % 12));
}

/** The note `steps` scale tones above (+) or below (−) `from` (from itself need not be in the scale). */
export function scaleStep(from: number, steps: number, pcs: Set<number>) {
  if (!pcs.size || steps === 0) return from;
  const dir = Math.sign(steps);
  let m = from;
  for (let k = 0; k < Math.abs(steps); ) {
    m += dir;
    if (pcs.has(((m % 12) + 12) % 12)) k++;
  }
  return m;
}

/** MIDI of one step, given the scale that sounds when it is played. */
export function stepMidi(step: EncStep, target: number, pcs: Set<number>) {
  return step.type === 'chromatic' ? target + step.dist : scaleStep(target, step.dist, pcs);
}

/**
 * Make it shorter: drop the notes farthest from the target until `max` remain.
 * Ties go to the earliest note, so what is left still leads into the target.
 */
export function shorten<T extends { midi: number }>(notes: T[], target: number, max: number): T[] {
  const out = [...notes];
  while (out.length > Math.max(0, max)) {
    let far = 0;
    out.forEach((n, i) => {
      if (Math.abs(n.midi - target) > Math.abs(out[far].midi - target)) far = i;
    });
    out.splice(far, 1);
  }
  return out;
}

/** Example for the panel: the form towards D in C major (the requirements' examples). */
export function exampleText(form: EnclosureForm) {
  if (form.example) return form.example;
  const target = 62;
  const cMajor = new Set([0, 2, 4, 5, 7, 9, 11]);
  const names = form.steps.map((s) => {
    const m = stepMidi(s, target, cMajor);
    return pcName(m % 12, m > target);
  });
  return `${names.join('–')} → D`;
}

export type FitMode = 'ask' | 'sixteenths' | 'triplets' | 'shorter';
export type EncRhythm = 'onBeat' | 'anticipation' | 'suspension';
export type FillMode = 'rest' | 'scale' | 'arpeggio' | 'pattern';
