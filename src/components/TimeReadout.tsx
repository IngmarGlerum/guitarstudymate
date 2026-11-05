import { chakra } from '@chakra-ui/react';
import { useRef } from 'react';
import { useFrame } from '../hooks/useFrame';
import { formatTime } from '../lib/format';

/** Live clock. Writes straight to the DOM so playback never triggers a React render. */
export function TimeReadout({
  getTime,
  decimals = 2,
}: {
  getTime: () => number;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef('');

  useFrame(() => {
    const text = formatTime(getTime(), decimals);
    if (text !== last.current && ref.current) {
      ref.current.textContent = text;
      last.current = text;
    }
  });

  return (
    <chakra.span ref={ref} fontVariantNumeric="tabular-nums">
      {formatTime(0, decimals)}
    </chakra.span>
  );
}
