import { IconButton, Menu, Portal } from '@chakra-ui/react';
import { LuSettings } from 'react-icons/lu';
import type { AppSettings } from '../lib/appSettings';

/** Gear menu in the header. Grouped by subject so more settings can follow. */
export function SettingsMenu({
  settings,
  onChange,
  latencyMs,
  onCalibrate,
}: {
  settings: AppSettings;
  onChange: (next: AppSettings) => void;
  /** measured output latency, or null when the browser's estimate is used */
  latencyMs: number | null;
  onCalibrate: () => void;
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
            <Menu.Separator />
            <Menu.ItemGroup>
              <Menu.ItemGroupLabel fontSize="xs" color="fg.muted">
                Timing
              </Menu.ItemGroupLabel>
              <Menu.Item value="calibrate" closeOnSelect onSelect={onCalibrate}>
                Timing afstemmen…
                <Menu.ItemCommand fontSize="xs" color="fg.muted">
                  {latencyMs === null ? 'niet afgestemd' : `${latencyMs} ms`}
                </Menu.ItemCommand>
              </Menu.Item>
            </Menu.ItemGroup>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
