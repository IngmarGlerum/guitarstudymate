import { Box, Button, Dialog, Flex, Portal, Slider, Text } from '@chakra-ui/react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { LatencyTest, type LatencyResult, type LatencyState } from '../audio/latency';
import { useFrame } from '../hooks/useFrame';
import { palette } from '../theme/palette';

type Phase = 'intro' | 'tapping' | 'result';

const thumbShadow = '0 0 0 2px #1a1009, 0 2px 6px rgba(0,0,0,0.6)';

/**
 * Measure how late sound arrives by tapping along with clicks, then check it by
 * eye: a light that flashes with the click, shifted by the measured latency.
 */
export function LatencyDialog({
  open,
  onClose,
  latency,
}: {
  open: boolean;
  onClose: () => void;
  latency: LatencyState;
}) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [result, setResult] = useState<LatencyResult | null>(null);
  const [ms, setMs] = useState(latency.calibration?.ms ?? 0);
  const [failed, setFailed] = useState(false);
  const test = useRef<LatencyTest | null>(null);
  const dotsRef = useRef<HTMLDivElement>(null);

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setPhase('intro');
      setResult(null);
      setFailed(false);
      setMs(latency.calibration?.ms ?? 0);
    }
  }
  useEffect(() => {
    if (!open) test.current?.stop();
  }, [open]);
  useEffect(() => () => test.current?.stop(), []);

  const start = () => {
    test.current?.stop();
    const t = new LatencyTest();
    test.current = t;
    setPhase('tapping');
    setFailed(false);
    void t.start(() => {
      const r = t.result();
      t.stop();
      if (r) {
        setResult(r);
        setMs(r.ms);
        setPhase('result');
      } else {
        setFailed(true);
        setPhase('intro');
      }
    });
  };

  const tap = (timeStamp: number) => test.current?.tap(timeStamp);

  // progress dots, written straight to the DOM
  useFrame(() => {
    const el = dotsRef.current;
    if (!el || phase !== 'tapping' || !test.current) return;
    const p = test.current.progress();
    Array.from(el.children).forEach((c, i) => {
      (c as HTMLElement).style.background = i <= p ? palette.honey : 'rgba(241,230,204,0.15)';
    });
  });

  const save = () => {
    latency.save({
      ms,
      spreadMs: result?.spreadMs ?? latency.calibration?.spreadMs ?? 0,
      measuredAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} placement="center">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="bg.panel" borderWidth="1px" borderColor="border" mx="4">
            <Dialog.Header>
              <Dialog.Title fontFamily="heading" fontWeight="500">
                Timing afstemmen
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {phase === 'intro' && (
                <Flex direction="column" gap="3">
                  <Text fontSize="sm">
                    Koptelefoons en vooral Bluetooth laten geluid later horen dan het wordt afgespeeld.
                    Tik mee op de klik, dan meten we hoeveel later, en lopen de oplichtende noten gelijk met
                    wat je hoort.
                  </Text>
                  <Text fontSize="sm" color="fg.muted">
                    Zet je koptelefoon of speaker op zoals je oefent. Je hoort eerst vier tikken voortellen,
                    daarna zestien om op mee te tikken, met de spatiebalk of op de knop.
                  </Text>
                  {latency.calibration && (
                    <Text fontSize="sm" color="fg.muted">
                      Nu ingesteld: {latency.calibration.ms} ms.
                    </Text>
                  )}
                  {failed && (
                    <Text fontSize="sm" color="cherry.300" role="alert">
                      Te weinig tikken op de klik gehoord. Probeer het nog eens.
                    </Text>
                  )}
                </Flex>
              )}

              {phase === 'tapping' && (
                <Flex direction="column" align="center" gap="4">
                  <Flex ref={dotsRef} gap="1.5" aria-hidden="true">
                    {Array.from({ length: 16 }, (_, i) => (
                      <Box key={i} boxSize="10px" rounded="full" bg="rgba(241,230,204,0.15)" />
                    ))}
                  </Flex>
                  <Box
                    as="button"
                    w="full"
                    h="140px"
                    rounded="lg"
                    borderWidth="1px"
                    borderColor="brass.600"
                    bg="bg.subtle"
                    fontFamily="heading"
                    fontSize="2xl"
                    autoFocus
                    onPointerDown={(e: PointerEvent<HTMLElement>) => tap(e.timeStamp)}
                    onKeyDown={(e: KeyboardEvent<HTMLElement>) => {
                      if (e.code === 'Space' || e.key === 'Enter') {
                        e.preventDefault();
                        if (!e.repeat) tap(e.timeStamp);
                      }
                    }}
                    _focusVisible={{ outline: `2px solid ${palette.honey}` }}
                  >
                    Tik mee
                  </Box>
                  <Text fontSize="xs" color="fg.muted">
                    Spatiebalk of klik op het vlak
                  </Text>
                </Flex>
              )}

              {phase === 'result' && (
                <Flex direction="column" gap="4">
                  {result && (
                    <Text fontSize="sm">
                      Gemeten: <b>{result.ms} ms</b> (spreiding ±{result.spreadMs} ms, {result.taps} tikken).
                    </Text>
                  )}
                  <LatencyCheck ms={ms} />
                  <Flex align="center" gap="3">
                    <Text fontSize="sm" whiteSpace="nowrap">
                      Vertraging
                    </Text>
                    <Slider.Root
                      size="sm"
                      colorPalette="brass"
                      min={0}
                      max={400}
                      step={5}
                      value={[ms]}
                      onValueChange={(d) => setMs(d.value[0])}
                      flex="1"
                      aria-label={['Vertraging in milliseconden']}
                    >
                      <Slider.Control>
                        <Slider.Track bg="rgba(241,230,204,0.16)">
                          <Slider.Range />
                        </Slider.Track>
                        <Slider.Thumb index={0} boxShadow={thumbShadow}>
                          <Slider.HiddenInput />
                        </Slider.Thumb>
                      </Slider.Control>
                    </Slider.Root>
                    <Text fontSize="sm" fontVariantNumeric="tabular-nums" minW="56px" textAlign="right">
                      {ms} ms
                    </Text>
                  </Flex>
                  <Text fontSize="xs" color="fg.muted">
                    Het lichtje moet precies tegelijk met de klik oplichten. Schuif bij als het voor of na
                    de klik komt.
                  </Text>
                </Flex>
              )}
            </Dialog.Body>
            <Dialog.Footer justifyContent="space-between" flexWrap="wrap" gap="2">
              <Box>
                {latency.calibration && phase !== 'tapping' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      latency.save(null);
                      onClose();
                    }}
                  >
                    Browserschatting gebruiken
                  </Button>
                )}
              </Box>
              <Flex gap="2">
                <Button variant="ghost" onClick={onClose}>
                  Annuleren
                </Button>
                {phase === 'intro' && (
                  <Button colorPalette="brass" onClick={start}>
                    Start
                  </Button>
                )}
                {phase === 'result' && (
                  <>
                    <Button variant="outline" onClick={start}>
                      Opnieuw
                    </Button>
                    <Button colorPalette="brass" onClick={save}>
                      Opslaan
                    </Button>
                  </>
                )}
              </Flex>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

/** A click every beat and a light that flashes `ms` later than the click is scheduled. */
function LatencyCheck({ ms }: { ms: number }) {
  const [on, setOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const clicks = useRef<number[]>([]);
  const timer = useRef(0);
  const lightRef = useRef<HTMLDivElement>(null);
  const msRef = useRef(ms);
  useEffect(() => {
    msRef.current = ms;
  });

  useEffect(() => {
    if (!on) return;
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    ctxRef.current = ctx;
    const beat = 0.75;
    let next = ctx.currentTime + 0.2;
    clicks.current = [];
    const schedule = () => {
      while (next < ctx.currentTime + 0.2) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 1175;
        env.gain.setValueAtTime(0, next);
        env.gain.linearRampToValueAtTime(0.7, next + 0.002);
        env.gain.exponentialRampToValueAtTime(0.001, next + 0.05);
        osc.connect(env).connect(ctx.destination);
        osc.start(next);
        osc.stop(next + 0.06);
        clicks.current.push(next);
        if (clicks.current.length > 8) clicks.current.shift();
        next += beat;
      }
    };
    void ctx.resume().then(schedule);
    timer.current = window.setInterval(schedule, 25);
    return () => {
      window.clearInterval(timer.current);
      void ctx.close();
      ctxRef.current = null;
    };
  }, [on]);

  useFrame(() => {
    const ctx = ctxRef.current;
    const light = lightRef.current;
    if (!light) return;
    if (!ctx) {
      light.style.opacity = '0.15';
      return;
    }
    const heard = ctx.currentTime - msRef.current / 1000;
    const lit = clicks.current.some((c) => heard >= c && heard < c + 0.09);
    light.style.opacity = lit ? '1' : '0.15';
  });

  return (
    <Flex align="center" gap="4" p="3" rounded="md" bg="bg.subtle" borderWidth="1px" borderColor="border">
      <Box
        ref={lightRef}
        boxSize="28px"
        rounded="full"
        bg={palette.honey}
        opacity={0.15}
        boxShadow="0 0 16px rgba(240,180,90,0.8)"
        aria-hidden="true"
      />
      <Text fontSize="sm" flex="1">
        Controle: klik en lichtje
      </Text>
      <Button size="xs" variant="outline" colorPalette="brass" onClick={() => setOn((v) => !v)}>
        {on ? 'Stop' : 'Afspelen'}
      </Button>
    </Flex>
  );
}
