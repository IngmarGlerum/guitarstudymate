import { Flex, NativeSelect, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

/** A small label above a control. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Flex direction="column" gap="1" minW="0">
      <Text fontSize="xs" color="fg.muted">
        {label}
      </Text>
      {children}
    </Flex>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  w,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; group?: string }[];
  w?: string;
}) {
  // consecutive options with the same group go into one <optgroup>
  const groups: { group?: string; items: typeof options }[] = [];
  for (const o of options) {
    const last = groups[groups.length - 1];
    if (last && last.group === o.group) last.items.push(o);
    else groups.push({ group: o.group, items: [o] });
  }
  return (
    <Field label={label}>
      <NativeSelect.Root size="sm" w={w}>
        <NativeSelect.Field
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
        >
          {groups.map((g, i) =>
            g.group ? (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              g.items.map((o) => (
                <option key={`${i}-${o.value}`} value={o.value}>
                  {o.label}
                </option>
              ))
            ),
          )}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Field>
  );
}

