import type { NoteDocument, NoteEvent } from './types';

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** 60 -> "C4" */
export function noteName(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Open strings in standard tuning, low to high (E2 A2 D3 G3 B3 E4). */
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64] as const;

const round = (value: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

export function toDocument(notes: NoteEvent[], name: string, duration: number): NoteDocument {
  return {
    version: 1,
    source: { name, duration: round(duration, 3) },
    engine: 'basic-pitch',
    notes: notes.map((n) => ({
      start: round(n.start, 3),
      duration: round(n.duration, 3),
      midi: n.midi,
      amplitude: round(n.amplitude, 3),
    })),
  };
}

export function downloadDocument(doc: NoteDocument) {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.source.name.replace(/\.[^.]+$/, '')}.noten.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
