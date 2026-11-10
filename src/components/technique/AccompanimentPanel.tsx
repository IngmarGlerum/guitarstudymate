import { Box, Flex, Input, NativeSelect, Slider, Switch, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import type { PartId } from '../../technique/accomp/accompaniment';
import { STYLES, type StyleId } from '../../technique/accomp/styles';

export interface AccompPrefs {
  on: boolean;
  style: StyleId;
  /** 'scale': the chord that belongs to the exercise's scale; 'custom': typed chords */
  source: 'scale' | 'custom';
  customLine: string;
  pianoSound: 'acoustic_grand_piano' | 'electric_piano_1';
  parts: Record<PartId, { on: boolean; volume: number }>;
}

const PART_LABEL: Record<PartId, string> = { bass: 'Bas', piano: 'Piano', drums: 'Drums', drone: 'Drone' };
const thumbShadow = '0 0 0 2px #1a1009, 0 2px 6px rgba(0,0,0,0.6)';

interface Props {
  prefs: AccompPrefs;
  onChange: (p: AccompPrefs) => void;
  /** e.g. "Cmaj7", the chord used when source is 'scale' */
  scaleChordName: string;
  /** chord names that could not be read from the custom line */
  unknown: string[];
  /** a progression or lick: the combo plays its chords */
  progression?: boolean;
}

/** The combo's controls: style, chords, piano sound and a small mixer. */
export function AccompanimentPanel({ prefs, onChange, scaleChordName, unknown, progression }: Props) {
  const set = (patch: Partial<AccompPrefs>) => onChange({ ...prefs, ...patch });
  const setPart = (part: PartId, patch: Partial<{ on: boolean; volume: number }>) =>
    set({ parts: { ...prefs.parts, [part]: { ...prefs.parts[part], ...patch } } });

  return (
    <Box px={{ base: 3, md: 5 }} py="3.5" borderTopWidth="1px" borderColor="border" bg="bg.subtle">
      <Flex align="flex-end" gap={{ base: 3, md: 4 }} wrap="wrap">
        <Switch.Root checked={prefs.on} onCheckedChange={(e) => set({ on: e.checked })} colorPalette="brass">
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Label fontFamily="heading" fontSize="md">
            Begeleiding
          </Switch.Label>
        </Switch.Root>

        <Labeled label="Stijl">
          <NativeSelect.Root size="sm" w="140px" disabled={!prefs.on}>
            <NativeSelect.Field
              aria-label="Stijl"
              value={prefs.style}
              onChange={(e) => set({ style: e.currentTarget.value as StyleId })}
            >
              {STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Labeled>

        {progression ? (
          <Labeled label="Akkoorden">
            <Text fontSize="sm" h="8" display="flex" alignItems="center">
              Die van de oefening
            </Text>
          </Labeled>
        ) : (
        <Labeled label="Akkoorden">
          <NativeSelect.Root size="sm" w="210px" disabled={!prefs.on}>
            <NativeSelect.Field
              aria-label="Akkoorden"
              value={prefs.source}
              onChange={(e) => set({ source: e.currentTarget.value as AccompPrefs['source'] })}
            >
              <option value="scale">Bij de ladder: {scaleChordName}</option>
              <option value="custom">Eigen akkoorden</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Labeled>
        )}

        {prefs.source === 'custom' && !progression && (
          <Labeled label="Eén akkoord per maat">
            <Input
              size="sm"
              w="240px"
              value={prefs.customLine}
              disabled={!prefs.on}
              onChange={(e) => set({ customLine: e.currentTarget.value })}
              placeholder="Dm7 | G7 | Cmaj7"
              aria-label="Eigen akkoorden, één per maat"
              aria-invalid={unknown.length > 0}
            />
          </Labeled>
        )}

        <Labeled label="Pianogeluid">
          <NativeSelect.Root size="sm" w="170px" disabled={!prefs.on}>
            <NativeSelect.Field
              aria-label="Pianogeluid"
              value={prefs.pianoSound}
              onChange={(e) => set({ pianoSound: e.currentTarget.value as AccompPrefs['pianoSound'] })}
            >
              <option value="acoustic_grand_piano">Vleugel</option>
              <option value="electric_piano_1">Elektrische piano</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Labeled>
      </Flex>

      {prefs.source === 'custom' && !progression && unknown.length > 0 && (
        <Text fontSize="xs" color="cherry.300" mt="2" role="alert">
          Niet gelezen: {unknown.join(', ')}. Gebruik bijvoorbeeld Cmaj7, Dm7, G7, G7alt, F♯m7♭5 of B♭7♭9.
        </Text>
      )}

      <Flex mt="3.5" gap={{ base: 3, md: 6 }} wrap="wrap" opacity={prefs.on ? 1 : 0.5}>
        {(['bass', 'piano', 'drums', 'drone'] as PartId[]).map((part) => (
          <Flex key={part} align="center" gap="2.5" minW="200px" flex="1" maxW="260px">
            <Switch.Root
              size="sm"
              colorPalette="brass"
              checked={prefs.parts[part].on}
              disabled={!prefs.on}
              onCheckedChange={(e) => setPart(part, { on: e.checked })}
            >
              <Switch.HiddenInput />
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Label fontSize="sm" minW="44px">
                {PART_LABEL[part]}
              </Switch.Label>
            </Switch.Root>
            <Slider.Root
              size="sm"
              colorPalette="brass"
              min={0}
              max={1}
              step={0.05}
              value={[prefs.parts[part].volume]}
              disabled={!prefs.on || !prefs.parts[part].on}
              onValueChange={(d) => setPart(part, { volume: d.value[0] })}
              flex="1"
              aria-label={[`Volume ${PART_LABEL[part].toLowerCase()}`]}
            >
              <Slider.Control>
                <Slider.Track bg="rgba(241,230,204,0.16)">
                  <Slider.Range />
                </Slider.Track>
                <Slider.Thumb index={0} boxShadow={thumbShadow}>
                  <Slider.HiddenInput />
                </Slider.Thumb>
              </Slider.Control>
            </Slider.Root>
          </Flex>
        ))}
      </Flex>

      <Text fontSize="2xs" color="fg.subtle" mt="3">
        Bas en piano: FluidR3_GM-soundfont van Frank Wen, via midi-js-soundfonts, licentie CC BY 3.0. Drums
        en drone worden in de browser gemaakt.
      </Text>
    </Box>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Flex direction="column" gap="1">
      <Text fontSize="xs" color="fg.muted">
        {label}
      </Text>
      {children}
    </Flex>
  );
}
