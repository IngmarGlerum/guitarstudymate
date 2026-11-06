import { Button, Dialog, Field, Input, Portal, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { parsePattern } from '../../technique/exercise';

interface Props {
  open: boolean;
  initial: number[];
  onClose: () => void;
  onApply: (pattern: number[]) => void;
}

/** Modal for a custom pattern: scale degrees such as 1, 2, 3, 7 (8 = root an octave up). */
export function PatternDialog({ open, initial, onClose, onApply }: Props) {
  const [text, setText] = useState(initial.join(', '));
  const [touched, setTouched] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    // reset the field each time the dialog opens
    setWasOpen(open);
    if (open) {
      setText(initial.join(', '));
      setTouched(false);
    }
  }
  const parsed = parsePattern(text);
  const error = typeof parsed === 'string' ? parsed : null;

  const apply = () => {
    setTouched(true);
    if (typeof parsed !== 'string') onApply(parsed);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="bg.panel" borderWidth="1px" borderColor="border" mx="4">
            <Dialog.Header>
              <Dialog.Title fontFamily="heading" fontWeight="500">
                Custom pattern
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Field.Root invalid={touched && error !== null}>
                <Field.Label>Toonladdergraden</Field.Label>
                <Input
                  value={text}
                  onChange={(e) => setText(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && apply()}
                  placeholder="1, 2, 3, 7"
                  autoFocus
                />
                {touched && error ? (
                  <Field.ErrorText>{error}</Field.ErrorText>
                ) : (
                  <Field.HelperText>
                    Getallen boven de 7 tellen door in het volgende octaaf: 8 is weer de grondtoon,
                    9 de tweede graad. Het patroon schuift stap voor stap door de hele vingerzetting.
                  </Field.HelperText>
                )}
              </Field.Root>
              <Text fontSize="xs" color="fg.muted" mt="3">
                Een stap die niet helemaal in de vingerzetting past, valt weg.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={onClose}>
                Annuleren
              </Button>
              <Button colorPalette="brass" onClick={apply}>
                Gebruiken
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
