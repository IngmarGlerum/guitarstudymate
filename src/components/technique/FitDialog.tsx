import { Button, Dialog, Flex, Portal, Text } from '@chakra-ui/react';
import { SUBDIVISIONS, type ExerciseSettings } from '../../technique/exercise';

interface Props {
  open: boolean;
  /** notes the longest enclosure needs before its target */
  need: number;
  /** room before the tightest chord change at the exercise's subdivision, at triplets and at sixteenths */
  room: { now: number; triplets: number; sixteenths: number };
  subdivision: number;
  onChoose: (mode: ExerciseSettings['fitMode']) => void;
  onClose: () => void;
}

const subLabel = (v: number) => SUBDIVISIONS.find((d) => d.value === v)?.label.toLowerCase() ?? '';
const notes = (n: number) => (n === 1 ? '1 noot' : `${n} noten`);

/**
 * An enclosure that does not fit the harmonic rhythm: play all its notes faster,
 * or drop the notes farthest from the target. The choice is kept in the exercise.
 */
export function FitDialog({ open, need, room, subdivision, onChoose, onClose }: Props) {
  const still = (r: number) => (r < need ? ' (nog steeds te krap: de rest wordt korter)' : '');
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="bg.panel" borderWidth="1px" borderColor="border" mx="4">
            <Dialog.Header>
              <Dialog.Title fontFamily="heading" fontWeight="500">
                Maak je oefening passend
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text fontSize="sm">
                De langste omspeling heeft {notes(need)} nodig voor de doelnoot, maar bij de snelste akkoordwissel is er
                in {subLabel(subdivision)} ruimte voor {notes(Math.max(0, room.now))}.
              </Text>
              <Flex direction="column" gap="1.5" mt="3" fontSize="sm" color="fg.muted">
                <Text>
                  <b>Make it fit!</b> Alle noten, maar sneller: de oefening gaat naar zestienden
                  {still(room.sixteenths)} of triolen{still(room.triplets)}.
                </Text>
                <Text>
                  <b>Make it shorter</b> Zelfde tempo; de noten die het verst van de doelnoot liggen vallen weg.
                </Text>
              </Flex>
              <Text fontSize="xs" color="fg.subtle" mt="3">
                Je keuze wordt onthouden in deze oefening en in presets. Wijzigen kan bij "Past het niet?".
              </Text>
            </Dialog.Body>
            <Dialog.Footer flexWrap="wrap" gap="2">
              {subdivision < 4 && (
                <Button colorPalette="brass" onClick={() => onChoose('sixteenths')}>
                  Make it fit! · zestienden
                </Button>
              )}
              {subdivision < 3 && (
                <Button colorPalette="brass" variant="outline" onClick={() => onChoose('triplets')}>
                  Make it fit! · triolen
                </Button>
              )}
              <Button variant="outline" onClick={() => onChoose('shorter')}>
                Make it shorter
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
