import { Button, Input, Switch, Text } from '@chakra-ui/react';
import { LuPencil } from 'react-icons/lu';
import type { ExerciseSettings } from '../../technique/exercise';
import { keyName } from '../../technique/harmony';
import { BUILTIN_PROGRESSIONS } from '../../technique/progressions';
import { ROOTS } from '../../technique/theory';
import type { ProgressionState } from '../../technique/useProgression';
import { Field, Select } from './fields';

const KEY_OPTIONS = ROOTS.flatMap((r) => [
  { value: `${r.pc}:maj`, label: `${r.label} majeur` },
  { value: `${r.pc}:min`, label: `${r.label} mineur` },
]);

/** Settings that only a progression has: source, key, bars, content, targets, window. */
export function ProgressionFields({
  settings,
  update,
  prog,
  onEditFillPattern,
}: {
  settings: ExerciseSettings;
  update: (patch: Partial<ExerciseSettings>) => void;
  prog: ProgressionState;
  onEditFillPattern: () => void;
}) {
  const enclosures = settings.content === 'enclosures';
  const bars = Array.from({ length: prog.totalBars }, (_, i) => String(i + 1));
  const autoFlats = ROOTS.find((r) => r.pc === prog.autoKey.pc)?.flats ?? false;

  return (
    <>
      <Select
        label="Progressie"
        value={settings.progressionId}
        onChange={(v) => update({ progressionId: v, barFrom: 1, barTo: 0, routeOff: {} })}
        options={[
          ...BUILTIN_PROGRESSIONS.map((p) => ({ value: p.id, label: p.label })),
          { value: 'custom', label: 'Eigen schema' },
        ]}
      />
      {settings.progressionId === 'custom' && (
        <Field label="Schema: maten met |, akkoorden in een maat delen de tellen">
          <Input
            size="sm"
            w={{ base: 'full', md: '340px' }}
            value={settings.progressionText}
            onChange={(e) => update({ progressionText: e.currentTarget.value, barFrom: 1, barTo: 0 })}
            placeholder="Dm7 G7 | Cmaj7 | Am7 | D7"
            aria-label="Eigen akkoordschema"
            aria-invalid={prog.parsed.unknown.length > 0}
          />
          {prog.parsed.unknown.length > 0 && (
            <Text fontSize="xs" color="cherry.300" role="alert" maxW="340px">
              Niet gelezen: {prog.parsed.unknown.join(', ')}. Gebruik bijvoorbeeld Cmaj7, Dm7, G7alt, F♯m7♭5,
              B♭7♭9 of C^7.
            </Text>
          )}
        </Field>
      )}
      <Select
        label="Toonsoort"
        value={settings.keyChoice}
        onChange={(v) => update({ keyChoice: v, routeOff: {} })}
        options={[{ value: 'auto', label: `Automatisch (${keyName(prog.autoKey, autoFlats)})` }, ...KEY_OPTIONS]}
      />
      {prog.totalBars > 1 && (
        <>
          <Select
            label="Van maat"
            value={String(prog.from)}
            onChange={(v) => update({ barFrom: Number(v) })}
            options={bars.map((b) => ({ value: b, label: b }))}
            w="88px"
          />
          <Select
            label="Tot en met"
            value={settings.barTo ? String(prog.to) : '0'}
            onChange={(v) => update({ barTo: Number(v) })}
            options={[{ value: '0', label: 'Einde' }, ...bars.slice(prog.from - 1).map((b) => ({ value: b, label: b }))]}
            w="96px"
          />
        </>
      )}
      <Select
        label="Inhoud"
        value={settings.content}
        onChange={(v) => update({ content: v as ExerciseSettings['content'] })}
        options={[
          { value: 'targets', label: 'Alleen doelnoten' },
          { value: 'scale', label: 'Ladder per akkoord' },
          { value: 'enclosures', label: 'Omspelingen' },
        ]}
      />
      {enclosures && (
        <>
          <Select
            label="Aankomst doelnoot"
            value={settings.enclosureRhythm}
            onChange={(v) => update({ enclosureRhythm: v as ExerciseSettings['enclosureRhythm'] })}
            options={[
              { value: 'onBeat', label: 'Op de tel' },
              { value: 'anticipation', label: 'Anticipatie (een noot eerder)' },
              { value: 'suspension', label: 'Voorhouding (een noot later)' },
            ]}
          />
          <Select
            label="Rest van het akkoord"
            value={settings.fill}
            onChange={(v) => update({ fill: v as ExerciseSettings['fill'] })}
            options={[
              { value: 'rest', label: 'Rust' },
              { value: 'scale', label: 'Ladder (lineair)' },
              { value: 'arpeggio', label: 'Arpeggio' },
              { value: 'pattern', label: 'Patroon' },
            ]}
          />
          {settings.fill === 'pattern' && (
            <Field label="Patroon">
              <Button size="sm" variant="outline" colorPalette="brass" onClick={onEditFillPattern}>
                {settings.pattern.join(' ')} <LuPencil />
              </Button>
            </Field>
          )}
          <Select
            label="Past het niet?"
            value={settings.fitMode}
            onChange={(v) => update({ fitMode: v as ExerciseSettings['fitMode'] })}
            options={[
              { value: 'ask', label: 'Vragen' },
              { value: 'sixteenths', label: 'Sneller: zestienden' },
              { value: 'triplets', label: 'Sneller: triolen' },
              { value: 'shorter', label: 'Korter' },
            ]}
          />
        </>
      )}
      <Select
        label="Doelnoten"
        value={settings.targetMode}
        onChange={(v) => update({ targetMode: v as ExerciseSettings['targetMode'] })}
        options={[
          { value: 'guide', label: 'Terts en septiem' },
          { value: 'all', label: 'Alle akkoordtonen' },
        ]}
      />
      <Select
        label="Positie"
        value={String(settings.windowLo)}
        onChange={(v) => update({ windowLo: Number(v) })}
        options={Array.from({ length: 16 }, (_, lo) => ({ value: String(lo), label: `Fret ${lo}–${lo + 4}` }))}
        w="118px"
      />
      <Field label="Bij akkoordwissel">
        <Switch.Root
          size="sm"
          colorPalette="brass"
          checked={settings.followPosition}
          onCheckedChange={(e) => update({ followPosition: e.checked })}
          h="9"
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Label fontSize="sm">Positie volgen</Switch.Label>
        </Switch.Root>
      </Field>
    </>
  );
}
