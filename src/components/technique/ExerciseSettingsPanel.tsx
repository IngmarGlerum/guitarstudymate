import { Button, Flex, NativeSelect, NumberInput, Text } from '@chakra-ui/react';
import { useState, type ReactNode } from 'react';
import { LuPencil } from 'react-icons/lu';
import type { PositionOption } from '../../technique/fingering';
import { SUBDIVISIONS, type ExerciseSettings } from '../../technique/exercise';
import { BPM_MAX, BPM_MIN } from '../../technique/settings';
import { ARPEGGIOS, pcName, ROOTS, SCALES, STRING_NAMES } from '../../technique/theory';
import { FAMILY_LABEL, libraryEntry } from '../../technique/library';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Flex direction="column" gap="1" minW="0">
      <Text fontSize="xs" color="fg.muted">
        {label}
      </Text>
      {children}
    </Flex>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  w,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; group?: string }[];
  w?: string;
}) {
  // consecutive options with the same group go into one <optgroup>
  const groups: { group?: string; items: typeof options }[] = [];
  for (const o of options) {
    const last = groups[groups.length - 1];
    if (last && last.group === o.group) last.items.push(o);
    else groups.push({ group: o.group, items: [o] });
  }
  return (
    <Field label={label}>
      <NativeSelect.Root size="sm" w={w}>
        <NativeSelect.Field
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
        >
          {groups.map((g, i) =>
            g.group ? (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              g.items.map((o) => (
                <option key={`${i}-${o.value}`} value={o.value}>
                  {o.label}
                </option>
              ))
            ),
          )}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Field>
  );
}

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
}

/** The exercise's dimensions, in the order of the requirements. */
export function ExerciseSettingsPanel({
  settings,
  update,
  perStringOptions,
  positionOptions,
  onEditPattern,
}: Props) {
  const flats = ROOTS.find((r) => r.pc === settings.rootPc)?.flats ?? false;
  const arpeggio = settings.kind === 'arpeggio';

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
        ]}
      />
      {settings.kind === 'pattern' && (
        <Field label="Patroon">
          <Button size="sm" variant="outline" colorPalette="brass" onClick={onEditPattern}>
            {settings.pattern.join(' ')} <LuPencil />
          </Button>
        </Field>
      )}
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
