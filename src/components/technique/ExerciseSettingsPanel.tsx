import { Button, Flex, NumberInput } from '@chakra-ui/react';
import { useState } from 'react';
import { LuPencil } from 'react-icons/lu';
import type { PositionOption } from '../../technique/fingering';
import { SUBDIVISIONS, type ExerciseSettings } from '../../technique/exercise';
import { BPM_MAX, BPM_MIN } from '../../technique/settings';
import { ARPEGGIOS, pcName, ROOTS, SCALES, STRING_NAMES } from '../../technique/theory';
import type { ProgressionState } from '../../technique/useProgression';
import { ProgressionFields } from './ProgressionFields';
import { Field, Select } from './fields';
import { FAMILY_LABEL, libraryEntry } from '../../technique/library';

const REPEAT_OPTIONS = [
  { value: '0', label: 'Eindeloos' },
  ...[1, 2, 3, 4, 5, 6, 8, 10].map((n) => ({ value: String(n), label: `${n}×` })),
];

interface Props {
  settings: ExerciseSettings;
  update: (patch: Partial<ExerciseSettings>) => void;
  perStringOptions: number[];
  positionOptions: PositionOption[];
  onEditPattern: () => void;
  onEditFillPattern: () => void;
  prog?: ProgressionState;
}

/** The exercise's dimensions, in the order of the requirements. */
export function ExerciseSettingsPanel({
  settings,
  update,
  perStringOptions,
  positionOptions,
  onEditPattern,
  onEditFillPattern,
  prog,
}: Props) {
  const flats = ROOTS.find((r) => r.pc === settings.rootPc)?.flats ?? false;
  const arpeggio = settings.kind === 'arpeggio';
  const isProg = settings.kind === 'progression' && !!prog;

  // local text so typing "8" on the way to "80" isn't clamped
  const [bpmText, setBpmText] = useState(String(settings.bpm));
  const [synced, setSynced] = useState(settings.bpm);
  if (synced !== settings.bpm) {
    setSynced(settings.bpm);
    setBpmText(String(settings.bpm));
  }

  return (
    <Flex wrap="wrap" gap={{ base: 3, md: 4 }} align="flex-end">
      <Select
        label="Type oefening"
        value={settings.kind}
        onChange={(v) => {
          if (v === 'pattern') onEditPattern();
          else update({ kind: v as ExerciseSettings['kind'] });
        }}
        options={[
          { value: 'scale', label: 'Toonladder' },
          { value: 'arpeggio', label: 'Arpeggio' },
          { value: 'pattern', label: 'Custom pattern' },
          { value: 'progression', label: 'Progressie' },
        ]}
      />
      {settings.kind === 'pattern' && (
        <Field label="Patroon">
          <Button size="sm" variant="outline" colorPalette="brass" onClick={onEditPattern}>
            {settings.pattern.join(' ')} <LuPencil />
          </Button>
        </Field>
      )}
      {isProg ? (
        <ProgressionFields settings={settings} update={update} prog={prog!} onEditFillPattern={onEditFillPattern} />
      ) : (
        <>
      {arpeggio ? (
        <Select
          label="Akkoord"
          value={settings.arpeggioId}
          onChange={(v) => update({ arpeggioId: v })}
          options={ARPEGGIOS.map((a) => ({ value: a.id, label: a.label }))}
        />
      ) : (
        <Select
          label="Toonladder"
          value={settings.scaleId}
          onChange={(v) => update({ scaleId: v })}
          options={SCALES.map((s) => ({
            value: s.id,
            label: s.label,
            group: FAMILY_LABEL[libraryEntry(s.id)?.family ?? 'major'],
          }))}
        />
      )}
      <Select
        label="Grondtoon"
        value={String(settings.rootPc)}
        onChange={(v) => update({ rootPc: Number(v) })}
        options={ROOTS.map((r) => ({ value: String(r.pc), label: r.label }))}
        w="104px"
      />
      <Select
        label="Positie"
        value={String(settings.position)}
        onChange={(v) => update({ position: Number(v) })}
        options={positionOptions.map((p, i) => {
          const first = p.fingering.notes[0];
          return {
            value: String(p.startDegree),
            label: `${i + 1} · vanaf ${pcName(first.midi % 12, flats)} (${STRING_NAMES[first.string]}-snaar, fret ${first.fret})`,
          };
        })}
      />
      {!arpeggio && (
        <Select
          label="Noten per snaar"
          value={String(settings.perString)}
          onChange={(v) => update({ perString: Number(v) })}
          options={perStringOptions.map((k) => ({
            value: String(k),
            label: k === 4 ? '4 (met slide)' : String(k),
          }))}
          w="132px"
        />
      )}
        </>
      )}
      <Select
        label="Onderverdeling"
        value={String(settings.subdivision)}
        onChange={(v) => update({ subdivision: Number(v) as ExerciseSettings['subdivision'] })}
        options={SUBDIVISIONS.map((d) => ({ value: String(d.value), label: d.label }))}
      />
      <Field label="Tempo (BPM)">
        <NumberInput.Root
          size="sm"
          w="96px"
          min={BPM_MIN}
          max={BPM_MAX}
          value={bpmText}
          invalid={!(Number(bpmText) >= BPM_MIN && Number(bpmText) <= BPM_MAX)}
          onValueChange={(d) => {
            setBpmText(d.value);
            if (d.valueAsNumber >= BPM_MIN && d.valueAsNumber <= BPM_MAX) {
              update({ bpm: d.valueAsNumber });
            }
          }}
        >
          <NumberInput.Control />
          <NumberInput.Input aria-label="Tempo in tellen per minuut" />
        </NumberInput.Root>
      </Field>
      {(!isProg ||
        settings.content === 'scale' ||
        (settings.content === 'enclosures' && (settings.fill === 'scale' || settings.fill === 'arpeggio'))) && (
      <Select
        label="Richting"
        value={settings.direction}
        onChange={(v) => update({ direction: v as ExerciseSettings['direction'] })}
        options={[
          { value: 'up', label: 'Omhoog' },
          { value: 'down', label: 'Omlaag' },
          { value: 'updown', label: 'Omhoog en omlaag' },
        ]}
      />
      )}
      <Select
        label="Herhalingen"
        value={String(settings.repeats)}
        onChange={(v) => update({ repeats: Number(v) })}
        options={REPEAT_OPTIONS}
        w="120px"
      />
    </Flex>
  );
}
