import { Box, Checkbox, Flex, NativeSelect, SimpleGrid, Text } from '@chakra-ui/react';
import { chordName } from '../../technique/chords';
import { ENCLOSURES, exampleText, GROUP_LABEL, type EnclosureForm } from '../../technique/enclosures';
import { BEATS_PER_BAR, SUBDIVISIONS, type ExerciseSettings } from '../../technique/exercise';
import type { BeatIssue } from '../../technique/progressionExercise';
import type { Segment } from '../../technique/progressions';
import { pcName } from '../../technique/theory';

const GROUPS = [1, 2, 3, 4, 5] as const;

/**
 * Enclosure forms (O-6): tick any number; the exercise takes one per target note,
 * in turn or at random. Shows when the forms were sped up or shortened, and the
 * bebop check (chord tones on the beat).
 */
export function EnclosuresPanel({
  settings,
  update,
  subdivision,
  shortened,
  beatIssues,
  segs,
  flats,
  barOffset,
}: {
  settings: ExerciseSettings;
  update: (patch: Partial<ExerciseSettings>) => void;
  /** the subdivision the exercise plays in (may be faster than chosen: Make it fit!) */
  subdivision: number;
  shortened: boolean;
  beatIssues: BeatIssue[];
  segs: Segment[];
  flats: boolean;
  barOffset: number;
}) {
  const on = new Set(settings.enclosureIds);
  const toggle = (id: string, checked: boolean) => {
    const next = ENCLOSURES.map((f) => f.id).filter((x) => (x === id ? checked : on.has(x)));
    update({ enclosureIds: next });
  };
  const faster = subdivision !== settings.subdivision;
  const subLabel = SUBDIVISIONS.find((d) => d.value === subdivision)?.label.toLowerCase();

  return (
    <Box px={{ base: 3, md: 5 }} py="3.5" borderTopWidth="1px" borderColor="border">
      <Flex align="center" gap="3" wrap="wrap" mb="2">
        <Text fontFamily="heading" fontSize="md">
          Omspelingen
        </Text>
        <NativeSelect.Root size="xs" w="150px">
          <NativeSelect.Field
            aria-label="Volgorde van de omspelingen"
            value={settings.enclosureOrder}
            onChange={(e) => update({ enclosureOrder: e.currentTarget.value as ExerciseSettings['enclosureOrder'] })}
          >
            <option value="sequence">Om de beurt</option>
            <option value="random">Willekeurig</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Text fontSize="xs" color="fg.muted">
          Per doelnoot de volgende aangevinkte vorm · voorbeelden met doelnoot D in C majeur
        </Text>
      </Flex>

      {!on.size && (
        <Text fontSize="xs" color="cherry.300" mb="2" role="alert">
          Geen vorm aangevinkt: je speelt alleen de doelnoten.
        </Text>
      )}
      {faster && (
        <Text fontSize="xs" color="brass.300" mb="2">
          Make it fit! De oefening speelt in {subLabel}, zodat elke omspeling past.
        </Text>
      )}
      {shortened && on.size > 0 && (
        <Text fontSize="xs" color="brass.300" mb="2">
          Make it shorter: waar te weinig ruimte is, vallen de noten het verst van de doelnoot weg.
        </Text>
      )}
      {beatIssues.length > 0 && (
        <Box mb="2">
          {beatIssues.slice(0, 4).map((b) => {
            const perBar = BEATS_PER_BAR * subdivision;
            return (
              <Text key={b.slot} fontSize="xs" color="cherry.300">
                Bebop: maat {Math.floor(b.slot / perBar) + barOffset}, tel {Math.floor((b.slot % perBar) / subdivision) + 1}:{' '}
                {pcName(b.midi % 12, flats)} is geen akkoordtoon van {chordName(segs[b.seg].chord, flats)}. Kies een
                andere aankomst of onderverdeling.
              </Text>
            );
          })}
        </Box>
      )}

      <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="2" maxH="320px" overflowY="auto" pr="1">
        {GROUPS.map((g) => (
          <Box key={g} p="2.5" rounded="md" bg="bg.subtle" borderWidth="1px" borderColor="border">
            <Text fontSize="2xs" color="fg.subtle" textTransform="uppercase" letterSpacing="0.04em" mb="1">
              {GROUP_LABEL[g]}
            </Text>
            {ENCLOSURES.filter((f) => f.group === g).map((f) => (
              <FormRow key={f.id} form={f} checked={on.has(f.id)} onChange={(c) => toggle(f.id, c)} />
            ))}
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
}

function FormRow({ form, checked, onChange }: { form: EnclosureForm; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <Box py="0.5">
      <Checkbox.Root size="sm" colorPalette="brass" checked={checked} onCheckedChange={(e) => onChange(!!e.checked)}>
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label fontSize="sm">{form.label}</Checkbox.Label>
      </Checkbox.Root>
      <Text fontSize="xs" color="fg.muted" ml="6">
        {exampleText(form)} · {form.steps.length} {form.steps.length === 1 ? 'noot' : 'noten'}
      </Text>
    </Box>
  );
}
