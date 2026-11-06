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
2. Klaar: audio naar noten. Basic Pitch (`@spotify/basic-pitch`, TF.js 3) in een worker
   (`src/transcription/`), resultaat als note events `{ start, duration, midi, amplitude }`,
   exporteerbaar als JSON. Getoond als pianorol in de notenlane. Werkt voor solo gitaar. Bij een
   volledige mix eerst de gitaar scheiden (bijvoorbeeld Demucs, server-side).
3. Klaar: notatielane (VexFlow 4.2.5, `vexflow/bravura`, lettertype zit in het pakket) onder de
   waveform. Tempo, maatsoort en tel 1 komen van de gebruiker (invullen of tikken, nooit detecteren).
   `src/notation/quantize.ts` zet noten op zestienden, één stem met akkoorden, rusten en overbindingen.
   Doorklinken over een volgende aanslag heen wordt een l.v.-boogje (`Piece.ring`) tot het echte einde,
   geen tweede stem. Een sterktedrempel (standaard 0,35) houdt zwakke noten (boventonen) uit de notatie.
   Een stiltegrens (`src/transcription/gate.ts`, standaard −20 dB onder de piek, RMS per 10 ms uit de
   worker) laat noten weg die in stilte beginnen en kort noten in tot waar de stilte begint.
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
- Transcriptie draait in `basicPitch.worker.ts`, nooit op de main thread. `useTranscription`
  beëindigt de worker bij een nieuw bestand, bij stoppen en bij unmount.
- TF.js 3.x roept in `setTimeoutCustom` `window` aan; in een worker gooit dat en blijft WebGL-
  inferentie stil hangen. De worker vervangt die functie daarom door gewone `setTimeout`. Niet weghalen.
- Waakhond: als het eerste venster op WebGL niet binnen 30 s klaar is, start de hook opnieuw op de CPU.
- Laanvolgorde: Opname, Notatie, Noten (pianorol). De tab-lane komt onder de notatie.
- Notatie: maat k begint op `downbeat + k × maatduur`, ook negatieve k (opmaat). Elke noot staat op
  `maatbegin + BAR_PAD + tick/maatticks × (maatbreedte − BAR_PAD)`; daarna wordt de TickContext
  bijgeschoven tot `getNoteHeadBeginX()` precies daar valt. Sleutel en maatsoort zijn vastgepind links
  in beeld. Alleen zichtbare maten worden met VexFlow opgebouwd, bij elke scroll opnieuw.

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
- Stap 2 is getest in headless Chromium met een synthetisch Karplus-Strong-bestand (7 melodienoten
  plus een akkoord van 4): alle 11 noten gevonden binnen ±15 ms, plus 8 zachtere boventonen.
  WebGL en CPU gaven dezelfde uitvoer. Niet geprobeerd: echte gitaaropnames, een echte GPU
  (headless gebruikt software-GL), lange bestanden, Firefox en Safari.
- Openstaand: geheugengebruik bij lange opnames. De bibliotheek bewaart frames en onsets als geneste
  JS-arrays (ruim 100 MB bij 15 minuten). Oplossing: eigen inferentielus met `Float32Array`'s.
- Boventonen komen als losse zachte noten mee. Een filter op toonafstand (octaaf, duodecime) werkte niet:
  op het testbestand had de echte E3 in het E-mineurakkoord dezelfde sterkteverhouding tot E2 als de
  boventoon E4 tot E3. Daarom een instelbare drempel. De standaard 0,35 is gekozen op twee synthetische
  bestanden; op het arpeggiobestand zat een gespeelde noot op 0,36 en reikten boventonen tot 0,36.
- Echte opname van de eigenaar (droge riff in E mineur, 95 BPM, 10 s, `samples/guitar-riff-e-minor-95bpm-dry.mp3`): spelen zat tussen −1
  en −13 dB, de rusttellen op −25 tot −31 dB met een zachte echo (dezelfde toonhoogtes, 0,557 s later).
  Basic Pitch hoorde die echo: basnoten liepen door tot in de rust en er kwamen losse noten in de rusttel.
  Met de stiltegrens van −20 dB vallen 18 van de 74 noten weg (en 2 door de sterktedrempel) en worden
  de basnoten ingekort. De grens is
  op deze ene opname gekozen; bij galmige opnames of een zacht gespeeld stuk moet hij omlaag.
- Stap 3 is getest in headless Chromium op hetzelfde bestand: 4/4 en 3/4, tikken, inzoomen, telefoonbreedte.
  Nootkoppen vallen binnen een paar pixels op hun aanslag. Niet geprobeerd: lange stukken, snelle loopjes,
  echte opnames.
