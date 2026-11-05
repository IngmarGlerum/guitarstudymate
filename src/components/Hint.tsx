import { Portal, Tooltip } from '@chakra-ui/react';
import type { ReactElement } from 'react';

/** Small tooltip around a single trigger element, e.g. an icon button. */
export function Hint({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip.Root openDelay={350} closeDelay={0} positioning={{ placement: 'top' }}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Portal>
        <Tooltip.Positioner>
          <Tooltip.Content
            bg="bg.emphasized"
            color="fg"
            borderWidth="1px"
            borderColor="border.emphasized"
            fontSize="xs"
            px="2.5"
            py="1.5"
            rounded="md"
            shadow="lg"
          >
            {label}
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
    </Tooltip.Root>
  );
}
