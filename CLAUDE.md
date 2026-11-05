# Guitar Study Mate

Webapp om gitaarfragmenten te studeren: een opname laden, een stukje loopen, vertragen met
behoud van toonhoogte, en later meelezen in notatie en gitaartab.

De eigenaar werkt in het Nederlands. UI-teksten zijn Nederlands, code en comments Engels.

## Stack en commando's

Vite, React 19, TypeScript (strict), Chakra UI 3 (`createSystem` in `src/theme/system.ts`).
Lettertypen via `@fontsource`. Lint met oxlint.

```bash
npm run dev      # ontwikkelen
npm run build    # typecheck + productiebuild
npm run lint
```

Gebruik de Chakra v3-API (`Slider.Root`, `Tooltip.Root`, `colorPalette`), niet v2.

## Stappenplan

1. Klaar: audio-lane met upload, waveform, playhead, loop-locators, snelheid, zoom, sneltoetsen.
2. Audio naar noten: Basic Pitch (TF.js) in een worker, resultaat als note events
   `{ start, duration, midi, amplitude }` in JSON. Werkt voor solo gitaar. Bij een volledige mix
   eerst de gitaar scheiden (bijvoorbeeld Demucs, server-side). Decodeer opnieuw op 22,05 kHz mono.
3. Notatielane (VexFlow) onder de waveform. Quantiseren vraagt tempo: laat de gebruiker de BPM
   invullen of tikken in plaats van automatisch detecteren.
4. Tab-lane: MIDI naar (snaar, fret) met dynamic programming (Viterbi). Kosten voor
   handverplaatsing, spanwijdte (maximaal ongeveer 4 frets) en afstand tot een voorkeurspositie.
   Tuning en capo zijn parameters.
5. Handmatig corrigeren van noten en frets. De automatische transcriptie is nooit foutloos.

## Architectuurregels

- **Gedeelde tijdas**: x = tijd × pixels per seconde. Alle lanes staan in dezelfde horizontaal
  scrollende container in `Timeline.tsx`, dus playhead en loop snijden door elke lane heen.
- Notatie en tab worden op ritme gespatieerd, niet op seconden. Gebruik vaste maatbreedte bij
  constant tempo (maat n begint op `n × maatduur × pxPerSecond`), zodat maatgrenzen precies
  uitlijnen met de waveform.
- De playhead en de klok schrijven via `requestAnimationFrame` (`useFrame`) direct naar de DOM.
  Geen React-renders tijdens het afspelen.
- Afspelen, loop, snelheid en volume leven in `useAudioTransport`. Lanes zijn pure renderers;
  canvas-lanes gebruiken `useWindowedCanvas` (canvas ter grootte van het venster).
- De loop wrapt alleen als het einde tijdens het afspelen wordt gekruist, niet bij zoeken voorbij het einde.
- Maximaal 15 minuten per bestand. De gedecodeerde buffer wordt na de pieken niet bewaard.

## Ontwerprichting

Conservatorium- en live-room-sfeer, een zachte donkere modus zoals bij DAW's. De kleuren komen uit
de referentiefoto's: de houten oefenruimte en het gouden podiumlicht uit de drumstills, bekkens en
stekkers in messing, de ES-335 sunburst en de tweed Fender-versterker.

- Palet in `src/theme/palette.ts`: espresso en walnoot als basis, messing (`brass`) als accent,
  kersrood (`cherry`) voor de loop, perkament voor tekst.
- Lettertypen: Newsreader (serif, titels en getallen) en Instrument Sans (UI).
- Gitaarelementen mogen letterlijk terugkomen (stekker, f-gat, grille, tweed). Drums niet.
- Ingetogen houden: één opvallend element per scherm, nu het podiumlicht op de waveform.
- Gebruik Chakra-tokens in plaats van losse hex-waarden. Canvas-code leest uit `palette.ts`.
- Toegankelijkheid: Nederlandse aria-labels, zichtbare focus, `prefers-reduced-motion` respecteren.

## Wat nog niet gecontroleerd is

- Stap 1 is getest in headless Chrome met een synthetisch gitaarbestand, zonder testsuite in de repo.
  De klok is gemeten, het geluid niet: of de toonhoogte bij vertragen echt gelijk blijft (`preservesPitch`)
  is nog niet beluisterd.
- Alleen Chrome is geprobeerd, niet Firefox of Safari.
- Op touch maak je een loop met de Loop-knop en de locators; slepen over de waveform scrolt daar.
