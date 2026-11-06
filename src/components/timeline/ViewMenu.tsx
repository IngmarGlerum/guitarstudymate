import { Button, Menu, Portal } from '@chakra-ui/react';
import { LuChevronDown, LuRuler } from 'react-icons/lu';
import type { GridDivision } from './drawing';
import { DIVISIONS, type ViewPrefs } from './viewPrefs';

/** "Weergave" dropdown: which rulers to show, and the bar grid's subdivision. */
export function ViewMenu({
  prefs,
  onChange,
}: {
  prefs: ViewPrefs;
  onChange: (patch: Partial<ViewPrefs>) => void;
}) {
  return (
    <Menu.Root closeOnSelect={false} positioning={{ placement: 'bottom-end' }}>
      <Menu.Trigger asChild>
        <Button size="xs" variant="ghost" aria-label="Weergave: lineaals en raster">
          <LuRuler /> Weergave <LuChevronDown />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="200px" bg="bg.emphasized" borderWidth="1px" borderColor="border.emphasized">
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel fontSize="xs" color="fg.muted">
                Lineaal
              </Menu.ItemGroupLabel>
              <Menu.CheckboxItem
                value="time"
                checked={prefs.timeRuler}
                disabled={prefs.timeRuler && !prefs.barRuler}
                onCheckedChange={(checked) => onChange({ timeRuler: checked })}
              >
                Tijd
                <Menu.ItemIndicator />
              </Menu.CheckboxItem>
              <Menu.CheckboxItem
                value="bars"
                checked={prefs.barRuler}
                disabled={prefs.barRuler && !prefs.timeRuler}
                onCheckedChange={(checked) => onChange({ barRuler: checked })}
              >
                Maten
                <Menu.ItemIndicator />
              </Menu.CheckboxItem>
            </Menu.ItemGroup>
            <Menu.Separator />
            <Menu.RadioItemGroup
              value={String(prefs.division)}
              onValueChange={(d) => onChange({ division: Number(d.value) as GridDivision })}
            >
              <Menu.ItemGroupLabel fontSize="xs" color="fg.muted">
                Maatstreepjes in de golfvorm
              </Menu.ItemGroupLabel>
              {DIVISIONS.map((d) => (
                <Menu.RadioItem key={d.value} value={String(d.value)} disabled={!prefs.barRuler}>
                  {d.label}
                  <Menu.ItemIndicator />
                </Menu.RadioItem>
              ))}
            </Menu.RadioItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
