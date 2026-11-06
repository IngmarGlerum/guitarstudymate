import { Box, Button, Dialog, Field, Flex, IconButton, Input, Portal, Text } from '@chakra-ui/react';
import { useRef, useState, type ChangeEvent } from 'react';
import { LuDownload, LuTrash2, LuUpload } from 'react-icons/lu';
import type { ExerciseSettings } from '../../technique/exercise';
import { formulaFor } from '../../technique/exercise';
import type { usePresets } from '../../technique/presets';
import { pcName, ROOTS } from '../../technique/theory';

const SUB = ['', 'kwarten', 'achtsten', 'triolen', 'zestienden'];

function summary(s: ExerciseSettings) {
  const flats = ROOTS.find((r) => r.pc === s.rootPc)?.flats ?? false;
  const what =
    s.kind === 'pattern'
      ? `patroon ${s.pattern.join(' ')} in ${formulaFor(s).label.toLowerCase()}`
      : formulaFor(s).label.toLowerCase();
  const nps = s.kind === 'arpeggio' ? '' : ` · ${s.perString} per snaar`;
  return `${pcName(s.rootPc, flats)} ${what}${nps} · ${SUB[s.subdivision]} · ${s.bpm} BPM`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  current: ExerciseSettings;
  onLoad: (s: ExerciseSettings) => void;
  presets: ReturnType<typeof usePresets>;
}

/** Save the current exercise as a preset, load or delete one, export or import them all. */
export function PresetsDialog({ open, onClose, current, onLoad, presets }: Props) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { presets: list, saved, save, remove, exportFile, importFile } = presets;

  const onSave = () => {
    if (!name.trim()) return;
    save(name, current);
    setMessage(`Opgeslagen als "${name.trim()}".`);
    setName('');
  };

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = await importFile(file);
    setMessage(typeof result === 'string' ? result : `${result} preset${result === 1 ? '' : 's'} geïmporteerd.`);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} placement="center" size="md">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="bg.panel" borderWidth="1px" borderColor="border" mx="4">
            <Dialog.Header>
              <Dialog.Title fontFamily="heading" fontWeight="500">
                Presets
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Field.Root>
                <Field.Label>Huidige oefening opslaan</Field.Label>
                <Flex gap="2" w="full">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSave()}
                    placeholder="Naam, bijvoorbeeld Ochtend 3nps"
                    maxLength={80}
                  />
                  <Button colorPalette="brass" onClick={onSave} disabled={!name.trim()}>
                    Opslaan
                  </Button>
                </Flex>
                <Field.HelperText>{summary(current)}. Dezelfde naam vervangt de oude preset.</Field.HelperText>
              </Field.Root>

              <Box mt="5">
                <Text fontSize="sm" fontWeight="600" mb="2">
                  Opgeslagen
                </Text>
                {list.length === 0 ? (
                  <Text fontSize="sm" color="fg.muted">
                    Nog geen presets.
                  </Text>
                ) : (
                  <Flex direction="column" gap="1.5" maxH="260px" overflowY="auto">
                    {list.map((p) => (
                      <Flex
                        key={p.id}
                        align="center"
                        gap="2"
                        px="3"
                        py="2"
                        rounded="md"
                        bg="bg.subtle"
                        borderWidth="1px"
                        borderColor="border"
                      >
                        <Box flex="1" minW="0">
                          <Text fontSize="sm" lineClamp={1}>
                            {p.name}
                          </Text>
                          <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                            {summary(p.settings)}
                          </Text>
                        </Box>
                        <Button
                          size="xs"
                          variant="outline"
                          colorPalette="brass"
                          onClick={() => {
                            onLoad(p.settings);
                            onClose();
                          }}
                        >
                          Laden
                        </Button>
                        <IconButton
                          size="xs"
                          variant="ghost"
                          aria-label={`Preset ${p.name} verwijderen`}
                          onClick={() => remove(p.id)}
                        >
                          <LuTrash2 />
                        </IconButton>
                      </Flex>
                    ))}
                  </Flex>
                )}
              </Box>

              <Text fontSize="xs" color="fg.muted" mt="4">
                Presets staan alleen in deze browser. Exporteer ze als vangnet, bijvoorbeeld voor een
                ander apparaat of voordat je je browsergegevens wist.
              </Text>
              {!saved && (
                <Text fontSize="xs" color="cherry.300" mt="2" role="alert">
                  Deze browser staat opslaan niet toe; de presets verdwijnen als je de pagina sluit.
                  Exporteer ze om ze te bewaren.
                </Text>
              )}
              {message && (
                <Text fontSize="sm" mt="3" role="status">
                  {message}
                </Text>
              )}
            </Dialog.Body>
            <Dialog.Footer justifyContent="space-between" flexWrap="wrap" gap="2">
              <Flex gap="2">
                <Button size="sm" variant="ghost" onClick={exportFile} disabled={list.length === 0}>
                  <LuDownload /> Exporteren
                </Button>
                <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
                  <LuUpload /> Importeren
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(e) => void onImport(e)}
                />
              </Flex>
              <Button variant="ghost" onClick={onClose}>
                Sluiten
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
