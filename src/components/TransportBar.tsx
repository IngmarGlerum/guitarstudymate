import { Box, Button, Flex, IconButton, Slider, Text } from '@chakra-ui/react';
import {
  LuPause,
  LuPlay,
  LuRepeat,
  LuSkipBack,
  LuVolume1,
  LuVolume2,
  LuVolumeX,
  LuX,
} from 'react-icons/lu';
import { RATE_MAX, RATE_MIN, type Transport } from '../audio/useAudioTransport';
import { formatRate, formatTime } from '../lib/format';
import { Hint } from './Hint';
import { TimeReadout } from './TimeReadout';

const PRESETS = [0.5, 0.75, 1] as const;

const thumbShadow = '0 0 0 2px #1a1009, 0 2px 6px rgba(0,0,0,0.6)';
const trackBg = 'rgba(241,230,204,0.16)';

function Divider() {
  return (
    <Box
      display={{ base: 'none', lg: 'block' }}
      alignSelf="stretch"
      w="1px"
      bg="border"
      opacity={0.9}
    />
  );
}

export function TransportBar({ transport }: { transport: Transport }) {
  const {
    isPlaying,
    toggle,
    seek,
    getTime,
    duration,
    loop,
    loopEnabled,
    setLoopEnabled,
    setLoop,
    rate,
    setRate,
    volume,
    setVolume,
  } = transport;

  const VolumeIcon = volume === 0 ? LuVolumeX : volume < 0.5 ? LuVolume1 : LuVolume2;

  return (
    <Flex
      wrap="wrap"
      align="center"
      gap={{ base: 4, lg: 7 }}
      px={{ base: 3, md: 5 }}
      py="4"
      borderTopWidth="1px"
      borderColor="border"
      css={{
        backgroundImage: 'var(--wood-grain)',
        backgroundColor: '#1a1009',
        boxShadow: 'inset 0 1px 0 rgba(255,214,150,0.06)',
      }}
    >
      {/* play */}
      <Flex align="center" gap="3">
        <Hint label="Naar het begin (Home)">
          <IconButton
            aria-label="Naar het begin"
            variant="ghost"
            rounded="full"
            onClick={() => seek(loopEnabled && loop ? loop.start : 0)}
          >
            <LuSkipBack />
          </IconButton>
        </Hint>
        <Hint label={isPlaying ? 'Pauzeren (spatie)' : 'Afspelen (spatie)'}>
          <IconButton
            aria-label={isPlaying ? 'Pauzeren' : 'Afspelen'}
            colorPalette="brass"
            rounded="full"
            boxSize="14"
            fontSize="2xl"
            css={{
              background: 'radial-gradient(circle at 35% 30%, #f6d28f, #d9a441 55%, #9a6c22)',
              boxShadow:
                '0 0 0 3px #1a1009, 0 0 0 4px rgba(217,164,65,0.45), 0 6px 18px rgba(0,0,0,0.55), 0 0 26px rgba(240,180,90,0.22)',
              _hover: { filter: 'brightness(1.08)' },
              _active: { transform: 'scale(0.96)' },
            }}
            onClick={toggle}
          >
            {isPlaying ? <LuPause /> : <LuPlay style={{ marginLeft: 3 }} />}
          </IconButton>
        </Hint>
        <Box lineHeight="1.15" minW="8.5rem">
          <Text fontFamily="heading" fontSize="2xl" fontWeight="500" aria-label="Afspeelpositie">
            <TimeReadout getTime={getTime} />
          </Text>
          <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums">
            van {formatTime(duration, 2)}
          </Text>
        </Box>
      </Flex>

      <Divider />

      {/* loop */}
      <Flex align="center" gap="2.5">
        <Hint label="Loop aan of uit (L)">
          <Button
            aria-pressed={loopEnabled}
            colorPalette={loopEnabled ? 'cherry' : 'gray'}
            variant={loopEnabled ? 'solid' : 'outline'}
            size="sm"
            onClick={() => setLoopEnabled(!loopEnabled)}
          >
            <LuRepeat /> Loop
          </Button>
        </Hint>
        {loop ? (
          <>
            <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
              {formatTime(loop.start, 1)} – {formatTime(loop.end, 1)}
            </Text>
            <Hint label="Loop wissen (Delete)">
              <Button size="xs" variant="ghost" onClick={() => setLoop(null)}>
                <LuX /> Wissen
              </Button>
            </Hint>
          </>
        ) : (
          <Text fontSize="sm" color="fg.subtle" display={{ base: 'none', xl: 'block' }} maxW="16ch">
            Sleep over de golfvorm of druk op [ en ]
          </Text>
        )}
      </Flex>

      <Divider />

      {/* speed: value on top, slider and presets below */}
      <Flex
        direction="column"
        gap="1.5"
        flex={{ base: '1 1 100%', md: '0 1 auto' }}
        minW={{ md: '340px' }}
      >
        <Flex align="baseline" justify="space-between" gap="3">
          <Text fontSize="sm" color="fg.muted">
            Snelheid
          </Text>
          <Text
            fontWeight="600"
            color="brass.200"
            fontVariantNumeric="tabular-nums"
            aria-live="polite"
          >
            {formatRate(rate)}
          </Text>
        </Flex>
        <Flex align="center" gap="3">
          <Slider.Root
            size="sm"
            variant="solid"
            colorPalette="brass"
            min={RATE_MIN}
            max={RATE_MAX}
            step={0.05}
            value={[rate]}
            onValueChange={(d) => setRate(d.value[0])}
            flex="1"
            minW="130px"
            aria-label={['Afspeelsnelheid']}
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
          <Flex gap="1">
            {PRESETS.map((value) => {
              const active = Math.abs(rate - value) < 0.001;
              return (
                <Button
                  key={value}
                  size="xs"
                  px="2"
                  aria-label={`Snelheid ${formatRate(value)}`}
                  aria-pressed={active}
                  variant={active ? 'subtle' : 'ghost'}
                  colorPalette={active ? 'brass' : 'gray'}
                  onClick={() => setRate(value)}
                >
                  {formatRate(value)}
                </Button>
              );
            })}
          </Flex>
        </Flex>
      </Flex>

      <Divider />

      {/* volume */}
      <Flex
        align="center"
        gap="2.5"
        ml={{ lg: 'auto' }}
        flex={{ base: '1 1 100%', md: '0 1 auto' }}
      >
        <Hint label={volume === 0 ? 'Geluid aan' : 'Dempen'}>
          <IconButton
            aria-label={volume === 0 ? 'Geluid aan' : 'Dempen'}
            size="xs"
            variant="ghost"
            onClick={() => setVolume(volume === 0 ? 0.9 : 0)}
          >
            <VolumeIcon />
          </IconButton>
        </Hint>
        <Slider.Root
          size="sm"
          variant="solid"
          colorPalette="brass"
          min={0}
          max={1}
          step={0.01}
          value={[volume]}
          onValueChange={(d) => setVolume(d.value[0])}
          w={{ base: 'auto', md: '110px' }}
          flex={{ base: '1', md: 'none' }}
          aria-label={['Volume']}
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
    </Flex>
  );
}
