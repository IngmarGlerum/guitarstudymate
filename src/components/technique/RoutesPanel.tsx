import { Box, Checkbox, Flex, NativeSelect, SegmentGroup, Text } from '@chakra-ui/react';
import type { ExerciseSettings } from '../../technique/exercise';
import { chordName } from '../../technique/chords';
import { keyName, LAYER_LABEL, layerAllowed, routeLabel, type Layer } from '../../technique/harmony';
import { unitKey, type ProgressionPlan } from '../../technique/progressionExercise';

const LAYERS: Layer[] = ['inKey', 'common', 'adventurous'];

/**
 * Routes over the progression (R-3, R-4): a switch for how far to go, then per
 * cadence or chord the routes with checkboxes, grouped by layer. The ticked
 * routes form the pool the exercise plays in turn or at random.
 */
export function RoutesPanel({
  plan,
  settings,
  update,
  flats,
  current,
  barOffset,
}: {
  plan: ProgressionPlan;
  settings: ExerciseSettings;
  update: (patch: Partial<ExerciseSettings>) => void;
  flats: boolean;
  /** route playing now per unit id */
  current: Map<string, string>;
  /** first bar of the selection, so bar numbers match the whole progression */
  barOffset: number;
}) {
  const toggle = (key: string, routeId: string, on: boolean) => {
    const off = new Set(settings.routeOff[key] ?? []);
    if (on) off.delete(routeId);
    else off.add(routeId);
    update({ routeOff: { ...settings.routeOff, [key]: [...off] } });
  };

  return (
    <Box px={{ base: 3, md: 5 }} py="3.5" borderTopWidth="1px" borderColor="border">
      <Flex align="center" gap="3" wrap="wrap" mb="3">
        <Text fontFamily="heading" fontSize="md">
          Routes
        </Text>
        <SegmentGroup.Root
          size="xs"
          value={settings.routeLayer}
          onValueChange={(e) => e.value && update({ routeLayer: e.value as Layer })}
          aria-label="Welke routes"
        >
          <SegmentGroup.Indicator />
          <SegmentGroup.Items
            items={[
              { value: 'inKey', label: 'Binnen toonsoort' },
              { value: 'common', label: '+ Gangbare kleuren' },
              { value: 'adventurous', label: 'Alles' },
            ]}
          />
        </SegmentGroup.Root>
        <NativeSelect.Root size="xs" w="150px">
          <NativeSelect.Field
            aria-label="Volgorde van de routes"
            value={settings.routeOrder}
            onChange={(e) => update({ routeOrder: e.currentTarget.value as ExerciseSettings['routeOrder'] })}
          >
            <option value="sequence">Achter elkaar</option>
            <option value="random">Willekeurig</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Text fontSize="xs" color="fg.muted">
          Toonsoort: {keyName(plan.key, flats)} · per herhaling de volgende route
        </Text>
      </Flex>

      <Flex direction="column" gap="2" maxH="320px" overflowY="auto" pr="1">
        {plan.units.map((u) => {
          const key = unitKey(u, plan.segs);
          const routes = plan.routes.get(u.id) ?? [];
          const off = new Set(settings.routeOff[key] ?? []);
          const chords = u.segs.map((i) => chordName(plan.segs[i].chord, flats)).join(' ');
          const title =
            u.kind === 'single' ? chords : `${u.kind === 'iiVI' ? 'ii–V–I' : 'ii–V'} in ${keyName(u.key, flats)} · ${chords}`;
          return (
            <Box key={u.id} p="2.5" rounded="md" bg="bg.subtle" borderWidth="1px" borderColor="border">
              <Text fontSize="sm" mb="1.5">
                Maat {plan.segs[u.segs[0]].bar + barOffset} · {title}
              </Text>
              {LAYERS.map((layer) => {
                const inLayer = routes.filter((r) => r.layer === layer);
                if (!inLayer.length) return null;
                const allowed = layerAllowed(layer, settings.routeLayer);
                return (
                  <Box key={layer} mt="1" opacity={allowed ? 1 : 0.45}>
                    <Text fontSize="2xs" color="fg.subtle" textTransform="uppercase" letterSpacing="0.04em">
                      {LAYER_LABEL[layer]}
                    </Text>
                    {inLayer.map((r) => {
                      const playing = current.get(u.id) === r.id;
                      return (
                        <Box key={r.id} py="0.5">
                          <Checkbox.Root
                            size="sm"
                            colorPalette="brass"
                            checked={!off.has(r.id)}
                            disabled={!allowed}
                            onCheckedChange={(e) => toggle(key, r.id, !!e.checked)}
                          >
                            <Checkbox.HiddenInput />
                            <Checkbox.Control />
                            <Checkbox.Label fontSize="sm" color={playing ? 'brass.300' : undefined}>
                              {routeLabel(r, plan.segs, u)}
                              {playing ? ' · klinkt nu' : ''}
                            </Checkbox.Label>
                          </Checkbox.Root>
                          {r.note && (
                            <Text fontSize="xs" color="fg.muted" ml="6">
                              {r.note}
                            </Text>
                          )}
                          {r.warnings.map((w) => (
                            <Text key={w} fontSize="xs" color="cherry.300" ml="6">
                              Let op: {w}
                            </Text>
                          ))}
                        </Box>
                      );
                    })}
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Flex>
    </Box>
  );
}
