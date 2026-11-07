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

/**
 * Tweed-trimmed amp grille that fills the empty audio lane: where a recording
 * gets plugged in. Click (or Enter) to pick a file, or drop one anywhere.
 */
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
      h="full"
      p="6px"
      transition="box-shadow 0.25s, filter 0.25s"
      css={{
        backgroundColor: '#8a7648',
        backgroundImage: tweedTwill,
        boxShadow: dragging
          ? `inset 0 0 0 2px ${palette.honey}, 0 0 40px rgba(240,180,90,0.35)`
          : 'inset 0 1px 0 rgba(255,240,196,0.18)',
        '&:hover': { filter: loading ? 'none' : 'brightness(1.06)' },
        '&:focus-visible': { outline: `2px solid ${palette.honey}`, outlineOffset: '-2px' },
      }}
    >
      <Flex
        h="full"
        align="center"
        justify="center"
        gap={{ base: 3, md: 6 }}
        px={{ base: 3, md: 6 }}
        rounded="sm"
        position="relative"
        overflow="hidden"
        css={{
          backgroundColor: '#2a1810',
          backgroundImage: [
            dragging
              ? 'radial-gradient(ellipse 70% 120% at 50% 50%, rgba(240,180,90,0.38), transparent 75%)'
              : 'radial-gradient(ellipse 60% 110% at 50% 40%, rgba(240,180,90,0.13), transparent 75%)',
            grilleRibs,
          ].join(','),
          boxShadow: 'inset 0 4px 18px rgba(0,0,0,0.65)',
          transition: 'background-image 0.25s',
        }}
      >
        {loading ? (
          <>
            <Spinner size="md" color="brass.300" borderWidth="3px" />
            <Box>
              <Heading as="h2" fontFamily="heading" fontSize={{ base: 'lg', md: 'xl' }} fontWeight="500">
                Opname wordt ingelezen
              </Heading>
              <Text fontSize="sm" color="fg.muted">
                De golfvorm wordt berekend.
              </Text>
            </Box>
          </>
        ) : (
          <>
            <Box display={{ base: 'none', md: 'block' }} flexShrink={0}>
              <JackPlug width={150} />
            </Box>
            <Flex direction="column" gap="1.5" align={{ base: 'center', md: 'flex-start' }} textAlign={{ base: 'center', md: 'left' }} minW="0">
              <Heading
                as="h2"
                fontFamily="heading"
                fontSize={{ base: 'lg', md: '2xl' }}
                fontWeight="500"
                letterSpacing="-0.01em"
              >
                {dragging ? 'Laat los om te laden' : 'Sleep een opname hierheen'}
              </Heading>
              <Text fontSize="sm" color="fg.muted" maxW="44ch">
                WAV, MP3, M4A, OGG of FLAC, tot 15 minuten. Het bestand blijft op je eigen apparaat.
              </Text>
              {error ? (
                <Text
                  role="alert"
                  fontSize="sm"
                  color="cherry.200"
                  bg="rgba(79,26,17,0.75)"
                  borderWidth="1px"
                  borderColor="cherry.600"
                  rounded="md"
                  px="3"
                  py="1.5"
                  maxW="52ch"
                >
                  {error}
                </Text>
              ) : (
                <Button
                  colorPalette="brass"
                  size="sm"
                  mt="1"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPick();
                  }}
                >
                  <LuUpload /> Kies een bestand
                </Button>
              )}
            </Flex>
          </>
        )}
      </Flex>
    </Box>
  );
}
