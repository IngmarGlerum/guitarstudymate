import { Button, Text } from '@chakra-ui/react';
import { useRef, useState } from 'react';
import { LuUpload } from 'react-icons/lu';
import type { ExerciseSettings } from '../../technique/exercise';
import { readLickFile, type Lick } from '../../technique/licks';
import { ROOTS } from '../../technique/theory';
import { Field, Select } from './fields';

/** Settings for an imported lick: which one, which key, which hand position; and the import itself. */
export function LickFields({
  settings,
  update,
  licks,
  onImport,
  originalKey,
}: {
  settings: ExerciseSettings;
  update: (patch: Partial<ExerciseSettings>) => void;
  licks: Lick[];
  onImport: (licks: Lick[]) => void;
  /** name of the lick's own key, e.g. "C" */
  originalKey: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const readFile = async (file: File) => {
    try {
      const { licks: read, problems } = readLickFile(JSON.parse(await file.text()));
      if (read.length) onImport(read);
      const head = read.length ? `${read.length} licks ingelezen.` : 'Geen licks ingelezen.';
      setMessage({ text: [head, ...problems.slice(0, 5)].join(' '), error: problems.length > 0 || !read.length });
      if (read.length && !read.some((l) => l.number === settings.lickNumber)) update({ lickNumber: read[0].number });
    } catch {
      setMessage({ text: 'Dit bestand is geen geldige JSON.', error: true });
    }
  };

  return (
    <>
      {licks.length > 0 && (
        <>
          <Select
            label="Lick"
            value={String(settings.lickNumber)}
            onChange={(v) => update({ lickNumber: Number(v) })}
            options={licks.map((l) => ({
              value: String(l.number),
              label: `${l.number}${l.title ? ` · ${l.title}` : ''} · ${l.chords.split('|')[0].trim()}`,
            }))}
            w="190px"
          />
          <Select
            label="Toonsoort"
            value={String(settings.lickKey)}
            onChange={(v) => update({ lickKey: Number(v) })}
            options={[
              { value: '-1', label: `Origineel (${originalKey})` },
              ...ROOTS.map((r) => ({ value: String(r.pc), label: r.label })),
            ]}
            w="140px"
          />
          <Select
            label="Positie"
            value={String(settings.windowLo)}
            onChange={(v) => update({ windowLo: Number(v) })}
            options={Array.from({ length: 16 }, (_, lo) => ({ value: String(lo), label: `Fret ${lo}–${lo + 4}` }))}
            w="118px"
          />
        </>
      )}
      <Field label={licks.length ? `${licks.length} licks in deze browser` : 'Nog geen licks'}>
        <Button size="sm" variant="outline" colorPalette="brass" onClick={() => input.current?.click()}>
          <LuUpload /> Licks importeren
        </Button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Licks-bestand kiezen"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) void readFile(f);
            e.currentTarget.value = '';
          }}
        />
      </Field>
      {message && (
        <Text fontSize="xs" color={message.error ? 'cherry.300' : 'fg.muted'} role="status" maxW="420px" alignSelf="center">
          {message.text}
        </Text>
      )}
    </>
  );
}
