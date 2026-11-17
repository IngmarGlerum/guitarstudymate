import { chakra, Flex, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { BPM_MAX, BPM_MIN } from '../../technique/settings';

/**
 * The tempo in the transport, editable in place: type a number and press Enter
 * (or leave the field); arrow keys step by 1, with Shift by 5.
 */
export function BpmInput({ value, onChange }: { value: number; onChange: (bpm: number) => void }) {
  const [text, setText] = useState(String(value));
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setText(String(value));
  }
  const commit = (raw: string) => {
    const n = Math.round(Number(raw));
    if (Number.isFinite(n) && raw.trim() !== '') {
      const bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, n));
      onChange(bpm);
      setText(String(bpm));
    } else setText(String(value));
  };
  return (
    <Flex align="baseline" gap="1.5">
      <chakra.input
        type="text"
        inputMode="numeric"
        aria-label="Tempo in tellen per minuut, afspeelbalk"
        value={text}
        onChange={(e) => setText(e.currentTarget.value.replace(/[^\d]/g, '').slice(0, 3))}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit(e.currentTarget.value);
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setText(String(value));
            e.currentTarget.blur();
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const step = (e.shiftKey ? 5 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
            commit(String(value + step));
          }
        }}
        fontFamily="heading"
        fontSize="xl"
        lineHeight="1"
        fontVariantNumeric="tabular-nums"
        color="brass.300"
        bg="transparent"
        borderBottomWidth="1px"
        borderColor="transparent"
        px="0.5"
        w={`${Math.max(2, text.length) + 0.4}ch`}
        textAlign="right"
        cursor="text"
        _hover={{ borderColor: 'brass.700' }}
        _focusVisible={{ borderColor: 'brass.400', outline: 'none', bg: 'blackAlpha.300' }}
      />
      <Text fontFamily="heading" fontSize="xl" lineHeight="1">
        BPM
      </Text>
    </Flex>
  );
}
