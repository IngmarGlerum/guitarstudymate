import { Box, Dialog, Flex, Portal, SegmentGroup, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { chordType } from '../../technique/chords';
import { FAMILY_LABEL, LIBRARY } from '../../technique/library';
import { palette } from '../../theme/palette';

type Sort = 'brightness' | 'tension';

/**
 * The library as a staircase (B-9): every scale with its brightness, character
 * notes, tension and the chords it fits. Sorted by brightness or by tension.
 */
export function LibraryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sort, setSort] = useState<Sort>('brightness');
  const scales = LIBRARY.filter((e) => e.kind === 'scale');
  const rows = [...scales].sort((a, b) =>
    sort === 'brightness' ? b.brightness - a.brightness || a.tensionScore - b.tensionScore : a.tensionScore - b.tensionScore || b.brightness - a.brightness,
  );
  const minB = Math.min(...scales.map((s) => s.brightness));
  const maxB = Math.max(...scales.map((s) => s.brightness));

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} size="xl" scrollBehavior="inside">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="bg.panel" borderWidth="1px" borderColor="border" mx="3">
            <Dialog.Header>
              <Flex align="center" justify="space-between" w="full" gap="3" wrap="wrap">
                <Dialog.Title fontFamily="heading" fontWeight="500">
                  Bibliotheek
                </Dialog.Title>
                <SegmentGroup.Root size="xs" value={sort} onValueChange={(e) => e.value && setSort(e.value as Sort)} aria-label="Sorteren op">
                  <SegmentGroup.Indicator />
                  <SegmentGroup.Items
                    items={[
                      { value: 'brightness', label: 'Licht naar donker' },
                      { value: 'tension', label: 'Weinig naar veel spanning' },
                    ]}
                  />
                </SegmentGroup.Root>
              </Flex>
            </Dialog.Header>
            <Dialog.Body>
              <Flex direction="column" gap="1.5">
                {rows.map((e) => {
                  const light = (e.brightness - minB) / (maxB - minB || 1);
                  return (
                    <Flex
                      key={e.id}
                      align="center"
                      gap="3"
                      px="3"
                      py="2"
                      rounded="md"
                      bg="bg.subtle"
                      borderWidth="1px"
                      borderColor="border"
                      wrap="wrap"
                    >
                      {/* the step: wider and lighter for brighter scales */}
                      <Box w="64px" flexShrink={0} aria-hidden="true">
                        <Box
                          h="8px"
                          rounded="full"
                          w={`${20 + light * 80}%`}
                          style={{ background: `color-mix(in srgb, ${palette.honeyLight} ${Math.round(light * 100)}%, ${palette.oak})` }}
                        />
                      </Box>
                      <Box minW="150px" flex="1.2">
                        <Text fontSize="sm">{e.label}</Text>
                        <Text fontSize="xs" color="fg.muted">
                          {FAMILY_LABEL[e.family]}
                          {e.mode && e.family !== 'pentatonic' && e.family !== 'symmetric' ? ` · modus ${e.mode}` : ''}
                        </Text>
                      </Box>
                      <Text fontSize="xs" color="fg.muted" minW="140px" fontVariantNumeric="tabular-nums">
                        {e.degrees.join(' ')}
                      </Text>
                      <Box minW="70px">
                        <Text fontSize="2xs" color="fg.subtle">
                          Karakter
                        </Text>
                        <Text fontSize="xs" color="brass.300">
                          {e.characterDegrees.join(', ') || '—'}
                        </Text>
                      </Box>
                      <Box minW="100px">
                        <Text fontSize="2xs" color="fg.subtle">
                          Spanning
                        </Text>
                        <Flex align="center" gap="1" aria-label={`Spanning ${e.tensionScore} van 3`}>
                          {[0, 1, 2].map((i) => (
                            <Box key={i} boxSize="7px" rounded="full" bg={i < e.tensionScore ? 'cherry.400' : 'whiteAlpha.200'} />
                          ))}
                          <Text fontSize="xs" color="fg.muted" ml="1">
                            {e.tensions.join(' ') || 'geen'}
                          </Text>
                        </Flex>
                      </Box>
                      <Box minW="110px" flex="1">
                        <Text fontSize="2xs" color="fg.subtle">
                          Past op
                        </Text>
                        <Text fontSize="xs">{e.chordTypes.map((c) => chordType(c).symbol).join('  ')}</Text>
                      </Box>
                    </Flex>
                  );
                })}
              </Flex>
            </Dialog.Body>
            <Dialog.Footer>
              <Text fontSize="xs" color="fg.muted">
                Helderheid volgt uit de gemiddelde intervalgrootte; spanning telt ♭9, ♯9, ♯11 en ♭13, met een paar
                correcties met de hand. "Past op": de terts en septiem van het akkoord zitten in de ladder.
              </Text>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
