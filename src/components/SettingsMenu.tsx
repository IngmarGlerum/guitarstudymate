import { IconButton, Menu, Portal } from '@chakra-ui/react';
import { LuSettings } from 'react-icons/lu';
import type { AppSettings } from '../lib/appSettings';

/** Gear menu in the header. Grouped by subject so more settings can follow. */
export function SettingsMenu({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
}) {
  return (
    <Menu.Root closeOnSelect={false} positioning={{ placement: 'bottom-end' }}>
      {/* no tooltip wrapper: it took over the trigger and the menu lost its anchor */}
      <Menu.Trigger asChild>
        <IconButton aria-label="Instellingen" title="Instellingen" size="sm" variant="ghost">
          <LuSettings />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="260px" bg="bg.emphasized" borderWidth="1px" borderColor="border.emphasized">
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel fontSize="xs" color="fg.muted">
                Afspeelkop
              </Menu.ItemGroupLabel>
              <Menu.CheckboxItem
                value="return-to-start"
                checked={settings.returnToStartOnStop}
                onCheckedChange={(checked) => onChange({ ...settings, returnToStartOnStop: checked })}
              >
                Terug naar startpositie bij stoppen
                <Menu.ItemIndicator />
              </Menu.CheckboxItem>
            </Menu.ItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
