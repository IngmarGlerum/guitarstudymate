import { Box, Button, Flex, Heading } from '@chakra-ui/react';
import { useCallback, useRef, type ChangeEvent } from 'react';
import { LuUpload } from 'react-icons/lu';
import { MESSAGES, useAudioTransport } from './audio/useAudioTransport';
import { Logo } from './components/Logo';
import { Timeline } from './components/timeline/Timeline';
import { TransportBar } from './components/TransportBar';
import { UploadDropzone } from './components/UploadDropzone';
import { useFileDrop } from './hooks/useFileDrop';
import { useHotkeys } from './hooks/useHotkeys';
import { palette } from './theme/palette';

const AUDIO_EXTENSIONS = /\.(wav|wave|mp3|m4a|aac|ogg|oga|opus|flac|webm|weba)$/i;

function looksLikeAudio(file: File) {
  return file.type.startsWith('audio/') || AUDIO_EXTENSIONS.test(file.name);
}

export default function App() {
  const transport = useAudioTransport();
  const { status, error, track, load, fail } = transport;
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const handleFile = useCallback(
    (file: File) => {
      if (!looksLikeAudio(file)) {
        fail(MESSAGES.notAudio);
        return;
      }
      void load(file);
    },
    [load, fail],
  );

  const dragging = useFileDrop(handleFile);
  useHotkeys(transport);

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
          {ready && (
            <Button variant="outline" colorPalette="brass" size="sm" onClick={openPicker}>
              <LuUpload /> Ander bestand
            </Button>
          )}
        </Flex>
      </Box>

      <Box as="main" flex="1" w="full" maxW="1360px" mx="auto" px={{ base: 3, md: 8 }} py={{ base: 4, md: 8 }}>
        {ready ? (
          <Box
            rounded="lg"
            overflow="hidden"
            borderWidth="1px"
            borderColor="border"
            bg="bg.panel"
            css={{ boxShadow: `0 24px 70px rgba(0,0,0,0.5), 0 0 90px rgba(217,164,65,0.06)` }}
          >
            <Timeline key={`${track.name}-${track.size}-${track.duration}`} transport={transport} track={track} />
            <TransportBar transport={transport} />
          </Box>
        ) : (
          <UploadDropzone status={status} error={error} dragging={dragging} onPick={openPicker} />
        )}
      </Box>

      {/* dropping a new file onto a loaded session */}
      {ready && dragging && (
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
