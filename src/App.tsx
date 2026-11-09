import { Box, Button, Flex, Heading, SegmentGroup } from '@chakra-ui/react';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { LuUpload } from 'react-icons/lu';
import { MESSAGES, useAudioTransport } from './audio/useAudioTransport';
import { Logo } from './components/Logo';
import { SettingsMenu } from './components/SettingsMenu';
import { LatencyDialog } from './components/LatencyDialog';
import { useLatencyCalibration } from './audio/latency';
import { DEFAULT_APP_SETTINGS, isAppSettings, type AppSettings } from './lib/appSettings';
import { TechniqueView } from './components/technique/TechniqueView';
import { Timeline } from './components/timeline/Timeline';
import { TransportBar } from './components/TransportBar';
import { UploadDropzone } from './components/UploadDropzone';
import { useFileDrop } from './hooks/useFileDrop';
import { useHotkeys } from './hooks/useHotkeys';
import { useStoredState } from './hooks/useStoredState';
import { palette } from './theme/palette';
import { useTranscription } from './transcription/useTranscription';
import { useNotation } from './notation/useNotation';

const AUDIO_EXTENSIONS = /\.(wav|wave|mp3|m4a|aac|ogg|oga|opus|flac|webm|weba)$/i;

type Mode = 'play' | 'technique';
const isMode = (v: unknown): v is Mode => v === 'play' || v === 'technique';

function looksLikeAudio(file: File) {
  return file.type.startsWith('audio/') || AUDIO_EXTENSIONS.test(file.name);
}

export default function App() {
  const transport = useAudioTransport();
  const { status, error, track, load, fail, pause } = transport;
  const [mode, setMode] = useStoredState<Mode>('gsm.mode', 'play', isMode);
  const [appSettings, setAppSettings] = useStoredState<AppSettings>(
    'gsm.settings',
    DEFAULT_APP_SETTINGS,
    isAppSettings,
  );
  const latency = useLatencyCalibration();
  const [latencyOpen, setLatencyOpen] = useState(false);
  const { setReturnOnStop } = transport;
  useEffect(() => {
    setReturnOnStop(appSettings.returnToStartOnStop);
  }, [appSettings.returnToStartOnStop, setReturnOnStop]);

  // switching modes stops playback; each mode keeps its own state
  useEffect(() => {
    if (mode !== 'play') pause();
  }, [mode, pause]);
  const transcription = useTranscription();
  const { reset: resetTranscription, start: startTranscription } = transcription;
  const notation = useNotation(transcription.notes, transcription.envelope);
  const { reset: resetNotation } = notation;
  const fileRef = useRef<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const handleFile = useCallback(
    (file: File) => {
      setMode('play'); // a dropped recording always opens in Meespelen
      resetTranscription();
      resetNotation();
      if (!looksLikeAudio(file)) {
        fileRef.current = null;
        fail(MESSAGES.notAudio);
        return;
      }
      fileRef.current = file;
      void load(file);
    },
    [load, fail, resetTranscription, resetNotation, setMode],
  );

  const transcribe = useCallback(() => {
    if (fileRef.current) void startTranscription(fileRef.current);
  }, [startTranscription]);

  const dragging = useFileDrop(handleFile);
  useHotkeys(transport, mode === 'play');

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ''; // allow picking the same file again
  };

  const ready = status === 'ready' && track !== null;

  return (
    <Flex direction="column" minH="100dvh">
      <Box
        as="header"
        borderBottomWidth="1px"
        borderColor="border"
        css={{
          backgroundImage: 'var(--wood-grain)',
          backgroundColor: '#1a1009',
          boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
        }}
      >
        <Flex
          maxW="1360px"
          mx="auto"
          px={{ base: 3, md: 8 }}
          py="3.5"
          align="center"
          justify="space-between"
          gap="4"
        >
          <Flex align="center" gap="3" minW="0">
            <Logo />
            <Heading
              as="h1"
              fontFamily="heading"
              fontSize={{ base: 'xl', md: '2xl' }}
              fontWeight="500"
              letterSpacing="-0.01em"
              lineHeight="1"
            >
              Guitar Study Mate
            </Heading>
          </Flex>
          {/* the mode switch stays put at the far right; the file button sits to its left */}
          <Flex align="center" gap="3">
            {ready && mode === 'play' && (
              <Button
                variant="outline"
                colorPalette="brass"
                size="sm"
                onClick={openPicker}
                display={{ base: 'none', sm: 'inline-flex' }}
              >
                <LuUpload /> Ander bestand
              </Button>
            )}
            <SegmentGroup.Root
              size="sm"
              value={mode}
              onValueChange={(e) => e.value && setMode(e.value as Mode)}
              aria-label="Modus"
            >
              <SegmentGroup.Indicator />
              <SegmentGroup.Items
                items={[
                  { value: 'play', label: 'Meespelen' },
                  { value: 'technique', label: 'Techniek' },
                ]}
              />
            </SegmentGroup.Root>
            <SettingsMenu
              settings={appSettings}
              onChange={setAppSettings}
              latencyMs={latency.calibration?.ms ?? null}
              onCalibrate={() => setLatencyOpen(true)}
            />
          </Flex>
        </Flex>
      </Box>

      <Box as="main" flex="1" w="full" maxW="1360px" mx="auto" px={{ base: 3, md: 8 }} py={{ base: 4, md: 8 }}>
        <Box display={mode === 'technique' ? 'block' : 'none'}>
          <TechniqueView
            active={mode === 'technique'}
            latency={latency}
            onCalibrate={() => setLatencyOpen(true)}
          />
        </Box>
        {mode === 'play' && (
          <Box
            rounded="lg"
            overflow="hidden"
            borderWidth="1px"
            borderColor="border"
            bg="bg.panel"
            css={{ boxShadow: `0 24px 70px rgba(0,0,0,0.5), 0 0 90px rgba(217,164,65,0.06)` }}
          >
            <Timeline
              key={ready ? `${track.name}-${track.size}-${track.duration}` : 'empty'}
              transport={transport}
              track={ready ? track : null}
              emptyLane={
                <UploadDropzone status={status} error={error} dragging={dragging} onPick={openPicker} />
              }
              transcription={transcription}
              onTranscribe={transcribe}
              notation={notation}
            />
            {/* the transport only makes sense with a recording */}
            <Box
              opacity={ready ? 1 : 0.45}
              pointerEvents={ready ? 'auto' : 'none'}
              aria-disabled={!ready}
              inert={!ready}
            >
              <TransportBar transport={transport} />
            </Box>
          </Box>
        )}
      </Box>

      {/* dropping a new file onto a loaded session */}
      {ready && mode === 'play' && dragging && (
        <Flex
          position="fixed"
          inset="0"
          zIndex="overlay"
          align="center"
          justify="center"
          pointerEvents="none"
          css={{
            background: 'rgba(20,13,9,0.82)',
            boxShadow: `inset 0 0 0 3px ${palette.honey}`,
          }}
        >
          <Heading fontFamily="heading" fontWeight="500" fontSize="3xl">
            Laat los om te laden
          </Heading>
        </Flex>
      )}

      <LatencyDialog open={latencyOpen} onClose={() => setLatencyOpen(false)} latency={latency} />

      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.opus,.flac,.webm"
        hidden
        onChange={onInputChange}
      />
    </Flex>
  );
}
