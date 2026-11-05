import { Box, Button, Flex, Heading, Spinner, Text } from '@chakra-ui/react';
import type { KeyboardEvent } from 'react';
import { LuUpload } from 'react-icons/lu';
import type { LoadStatus } from '../audio/useAudioTransport';
import { palette } from '../theme/palette';
import { grilleRibs, tweedTwill } from '../theme/textures';
import { JackPlug } from './Logo';

interface Props {
  status: LoadStatus;
  error: string | null;
  dragging: boolean;
  onPick: () => void;
}

/** Tweed-trimmed amp grille: the empty state, where a recording gets plugged in. */
export function UploadDropzone({ status, error, dragging, onPick }: Props) {
  const loading = status === 'loading';

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!loading) onPick();
    }
  };

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label="Kies een audiobestand"
      aria-busy={loading}
      onClick={() => !loading && onPick()}
      onKeyDown={onKeyDown}
      cursor={loading ? 'progress' : 'pointer'}
      rounded="lg"
      p="10px"
      transition="box-shadow 0.25s, filter 0.25s"
      css={{
        backgroundColor: '#8a7648',
        backgroundImage: tweedTwill,
        boxShadow: dragging
          ? `0 0 0 2px ${palette.honey}, 0 0 60px rgba(240,180,90,0.45), 0 18px 50px rgba(0,0,0,0.6)`
          : '0 18px 50px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,240,196,0.18)',
        '&:hover': { filter: loading ? 'none' : 'brightness(1.06)' },
      }}
    >
      <Flex
        direction="column"
        align="center"
        justify="center"
        gap="4"
        minH={{ base: '340px', md: 'min(500px, 60dvh)' }}
        px="6"
        py="10"
        textAlign="center"
        rounded="md"
        position="relative"
        overflow="hidden"
        css={{
          backgroundColor: '#2a1810',
          backgroundImage: [
            dragging
              ? 'radial-gradient(ellipse 80% 90% at 50% 45%, rgba(240,180,90,0.38), transparent 75%)'
              : 'radial-gradient(ellipse 70% 80% at 50% 40%, rgba(240,180,90,0.13), transparent 75%)',
            grilleRibs,
          ].join(','),
          boxShadow: 'inset 0 4px 18px rgba(0,0,0,0.65)',
          transition: 'background-image 0.25s',
        }}
      >
        {loading ? (
          <>
            <Spinner size="lg" color="brass.300" borderWidth="3px" />
            <Heading as="h2" fontFamily="heading" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="500">
              Opname wordt ingelezen
            </Heading>
            <Text color="fg.muted">De golfvorm wordt berekend.</Text>
          </>
        ) : (
          <>
            <JackPlug width={224} />
            <Heading
              as="h2"
              fontFamily="heading"
              fontSize={{ base: '2xl', md: '3xl' }}
              fontWeight="500"
              letterSpacing="-0.01em"
            >
              {dragging ? 'Laat los om te laden' : 'Sleep een opname hierheen'}
            </Heading>
            <Text color="fg.muted" maxW="34ch">
              WAV, MP3, M4A, OGG of FLAC, tot 15 minuten. Het bestand blijft op je eigen apparaat.
            </Text>
            {error && (
              <Text
                role="alert"
                color="cherry.200"
                bg="rgba(79,26,17,0.75)"
                borderWidth="1px"
                borderColor="cherry.600"
                rounded="md"
                px="4"
                py="2.5"
                maxW="46ch"
              >
                {error}
              </Text>
            )}
            <Button
              colorPalette="brass"
              size="lg"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onPick();
              }}
            >
              <LuUpload /> Kies een bestand
            </Button>
          </>
        )}
      </Flex>
    </Box>
  );
}
