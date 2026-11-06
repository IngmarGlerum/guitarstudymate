import { Button, Flex, NativeSelect, NumberInput, Slider, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { LuFlag, LuHand } from 'react-icons/lu';
import type { Notation } from '../notation/useNotation';
import { BPM_MAX, BPM_MIN, METERS } from '../notation/tempo';
import { GATE_MAX_DB, GATE_MIN_DB } from '../notation/useNotation';
import { formatTime } from '../lib/format';
import { Hint } from './Hint';

const thumbShadow = '0 0 0 2px #1a1009, 0 2px 6px rgba(0,0,0,0.6)';
const trackBg = 'rgba(241,230,204,0.16)';

function Label({ children }: { children: string }) {
  return (
    <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
      {children}
    </Text>
  );
}

interface Props {
  notation: Notation;
  getTime: () => number;
  totalNotes: number;
}

/**
 * Tempo, meter and beat 1 (always: the bar ruler needs them too), plus the strength
 * threshold and silence gate once there are notes.
 */
export function NotationControls({ notation, getTime, totalNotes }: Props) {
  const {
    settings,
    tempo,
    keptCount,
    setBpm,
    tap,
    setBeatsPerBar,
    setDownbeat,
    setMinStrength,
    setGateDb,
  } = notation;

  // Local text so typing "8" on the way to "80" isn't clamped to 30.
  // Re-sync when the tempo changes from elsewhere (tapping).
  const [bpmText, setBpmText] = useState(settings.bpm === null ? '' : String(settings.bpm));
  const [syncedBpm, setSyncedBpm] = useState(settings.bpm);
  if (syncedBpm !== settings.bpm) {
    setSyncedBpm(settings.bpm);
    setBpmText(settings.bpm === null ? '' : String(settings.bpm));
  }

  return (
    <Flex
      align="center"
      gap={{ base: 3, md: 5 }}
      wrap="wrap"
      px={{ base: 3, md: 5 }}
      py="2.5"
      borderBottomWidth="1px"
      borderColor="border"
      bg="bg.subtle"
    >
      <Flex align="center" gap="2">
        <Label>Tempo</Label>
        <NumberInput.Root
          size="xs"
          w="84px"
          min={BPM_MIN}
          max={BPM_MAX}
          value={bpmText}
          // empty means "no tempo yet", not an error; only flag numbers out of range
          invalid={bpmText !== '' && !(Number(bpmText) >= BPM_MIN && Number(bpmText) <= BPM_MAX)}
          onValueChange={(d) => {
            setBpmText(d.value);
            if (d.value === '') setBpm(null);
            else if (d.valueAsNumber >= BPM_MIN && d.valueAsNumber <= BPM_MAX) setBpm(d.valueAsNumber);
          }}
        >
          <NumberInput.Control />
          <NumberInput.Input aria-label="Tempo in tellen per minuut" placeholder="BPM" />
        </NumberInput.Root>
        <Text fontSize="xs" color="fg.muted">
          BPM
        </Text>
        <Hint label="Tik een paar keer mee op de tel">
          <Button size="xs" variant="outline" colorPalette="brass" onClick={() => tap()}>
            <LuHand /> Tik
          </Button>
        </Hint>
      </Flex>

      <Flex align="center" gap="2">
        <Label>Maat</Label>
        <NativeSelect.Root size="xs" w="72px">
          <NativeSelect.Field
            aria-label="Maatsoort"
            value={settings.beatsPerBar}
            onChange={(e) => setBeatsPerBar(Number(e.currentTarget.value))}
          >
            {METERS.map((m) => (
              <option key={m} value={m}>
                {m}/4
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Flex>

      <Flex align="center" gap="2">
        <Hint label="De afspeelkop staat op tel 1 van een maat">
          <Button
            size="xs"
            variant="ghost"
            disabled={!tempo}
            onClick={() => setDownbeat(getTime())}
          >
            <LuFlag /> Tel 1 hier
          </Button>
        </Hint>
        {tempo && (
          <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums" whiteSpace="nowrap">
            op {formatTime(tempo.downbeat, 2)}
            {settings.downbeat === null ? ' (eerste noot)' : ''}
          </Text>
        )}
        {settings.downbeat !== null && (
          <Button size="xs" variant="plain" color="fg.muted" onClick={() => setDownbeat(null)}>
            Terug naar eerste noot
          </Button>
        )}
      </Flex>

      {totalNotes > 0 && (
        <>
      <Flex align="center" gap="3" flex="1" minW="220px" maxW="360px">
        <Label>Drempel</Label>
        <Slider.Root
          size="sm"
          variant="solid"
          colorPalette="brass"
          min={0}
          max={0.9}
          step={0.05}
          value={[settings.minStrength]}
          onValueChange={(d) => setMinStrength(d.value[0])}
          flex="1"
          aria-label={['Minimale sterkte van een noot']}
        >
          <Slider.Control>
            <Slider.Track bg={trackBg}>
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumb index={0} boxShadow={thumbShadow}>
              <Slider.HiddenInput />
            </Slider.Thumb>
          </Slider.Control>
        </Slider.Root>
      </Flex>

      <Flex align="center" gap="3" flex="1" minW="220px" maxW="360px">
        <Hint label="Zachter dan dit telt als stilte: echo en uitklinkende staarten vallen weg">
          <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
            Stilte
          </Text>
        </Hint>
        <Slider.Root
          size="sm"
          variant="solid"
          colorPalette="brass"
          min={GATE_MIN_DB}
          max={GATE_MAX_DB}
          step={1}
          value={[settings.gateDb]}
          onValueChange={(d) => setGateDb(d.value[0])}
          flex="1"
          aria-label={['Stiltegrens in decibel']}
        >
          <Slider.Control>
            <Slider.Track bg={trackBg}>
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumb index={0} boxShadow={thumbShadow}>
              <Slider.HiddenInput />
            </Slider.Thumb>
          </Slider.Control>
        </Slider.Root>
        <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums" whiteSpace="nowrap" minW="48px">
          {settings.gateDb.toString().replace('-', '−')} dB
        </Text>
      </Flex>

      <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums" whiteSpace="nowrap">
        {keptCount} van {totalNotes} noten
      </Text>
        </>
      )}
    </Flex>
  );
}
