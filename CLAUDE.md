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

## Werkwijze met git

- Werk op een feature-branch, open een pull request naar `main` en merge die zelf zodra het werk af is
  en `npm run build` slaagt (merge-commit, geen squash). Zo staat elke wijziging als PR in GitHub en zet
  Vercel hem in productie zonder dat de eigenaar iets hoeft te doen. Dat mag zonder het eerst te vragen.
- Voor een volgende wijziging: merge `main` in de branch (gewone merge, geen rebase of force-push),
  push en open een nieuwe PR met alleen de nieuwe commits.

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
   Basic Pitch knipt doorklinkende noten soms in aaneengesloten stukjes van dezelfde toonhoogte (waar
   andere snaren worden aangeslagen; `inferOnsets` uitzetten veranderde niets). `transcription/merge.ts`
   voegt die weer samen, behalve als de energie op de grondtoon bij de knip stijgt (≥ 0,6 dB, Goertzel over
   46 ms): dat is een echte nieuwe aanslag. Gemeten: knippen in de riff −1,1 tot −0,4 dB, echte nieuwe
   aanslagen (synthetisch) +1,3 tot +2,3 dB. Kleine marge; het octaaf meetellen maakte het slechter.
4. Tab-lane: MIDI naar (snaar, fret) met dynamic programming (Viterbi). Kosten voor
   handverplaatsing, spanwijdte (maximaal ongeveer 4 frets) en afstand tot een voorkeurspositie.
   Tuning en capo zijn parameters.
5. Handmatig corrigeren van noten en frets. De automatische transcriptie is nooit foutloos.

Modus Techniek (oefenmachine), volgens het requirementsdocument "Guitar Study Mate – Requirements
Oefenmachine" (claude.ai/artifact/UwC4ARkj4LRDs7kxjiMw9Q):
- Klaar: instellingen, ladders en arpeggio's, posities en vingerzettingen, custom pattern, notenbalk met
  Tab of Gitaarhals, metronoom en Karplus-Strong-geluid, voortellen, volumes, modusschakelaar, presets
  (`technique/presets.ts`: localStorage, export/import als `{ format: "guitar-study-mate/presets",
  version: 1, presets }`, dezelfde naam vervangt, instellingen worden bij inlezen genormaliseerd).
- Nog niet: één echt gedeelde speler tussen de modi, Tab/Gitaarhals in Meespelen (wacht op de tab-lane),
  gesamplede gitaar. De open vragen uit sectie 13 zijn niet beantwoord; gekozen is: kwarten, achtsten,
  triolen, zestienden; vast tempo; positie als "nummer · vanaf noot (snaar, fret)"; patroon 1–15, maximaal
  16 getallen, herhalingen toegestaan; een patroon wordt mee opgeslagen in de preset.

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
- Lineaals: tijd (30 px) en maten (26 px) boven elkaar, aan of uit via het menu Weergave; minstens één
  staat aan (de loop-locators zitten in de lineaal). Alle lane-posities volgen uit de totale hoogte.
  Staat de maatlineaal aan en is er een tempo, dan tekenen golfvorm en pianorol het maatraster
  (`drawBarGrid`, kwarten/achtsten/zestienden) in plaats van het secondenraster. Tempo, maat en tel 1
  staan altijd in beeld, ook zonder herkende noten.
- Notatie: maat k begint op `downbeat + k × maatduur`, ook negatieve k (opmaat). Elke noot staat op
  `maatbegin + BAR_PAD + tick/maatticks × (maatbreedte − BAR_PAD)`; daarna wordt de TickContext
  bijgeschoven tot `getNoteHeadBeginX()` precies daar valt. Sleutel en maatsoort staan in de kopkolom
  links van de lane (`NotationHeader`, zelfde `STAVE_Y`), nooit over de noten heen. Op smalle schermen is
  die kolom verborgen en is er dus geen sleutel. Alleen zichtbare maten worden met VexFlow opgebouwd, bij elke scroll opnieuw.

- Techniek: rekenkern in `src/technique/` zonder React (theory, fingering, exercise, engine), scherm in
  `src/components/technique/`. Vingerzetting toonladder = de ladder in volgorde, `perString` noten per
  snaar van lage naar hoge E, rek per snaar ≤ 5 frets (bij 4 noten per snaar een slide op de tweede noot).
  Arpeggio = akkoordtonen in volgorde, liefst op de volgende snaar binnen de positie (anchor −1 tot +5).
  Dubbele posities: zelfde relatieve vorm wordt weggelaten. Een positie begint op de lage E op fret 0–11;
  past hij daar niet (bijvoorbeeld een overmatige secunde vlak boven fret 0), dan een octaaf hoger (12–23).
  Zo hebben ladders met 7 tonen bij 2 en 3 noten per snaar altijd 7 posities. Bij 4 noten per snaar lopen
  hoge posities voorbij fret 22 (24 noten, ruim 3,5 octaaf) en vallen weg: meestal 4 of 5 posities.
- Een klik op een noot speelt hem af via `technique/preview.ts` (eigen kleine AudioContext, dezelfde
  Karplus-Strong-snaar). In Meespelen: `pitchesAt` (notatie) en `noteAt` (pianorol), naast het zoeken.
- Zonder opname toont Meespelen de lege trackweergave (`Timeline` met `track = null`, 30 s placeholder-as);
  het sleepvlak (`UploadDropzone`) zit in de audiotrack, de afspeelbalk is gedimd en inert.
- Kop, van rechts: tandwiel (Instellingen), modusschakelaar, "Ander bestand". Alles links van de
  schakelaar mag komen en gaan; de schakelaar zelf verschuift niet. Geen Tooltip om een Menu.Trigger: dan
  verliest het menu zijn anker en opent het buiten beeld.
- Slepen (loop maken, locators, greep) stopt zodra een pointermove binnenkomt zonder ingedrukte knop of de
  pointer capture verloren gaat; anders bleef de loop aan de muis plakken als het loslaten elders viel.
- Automatisch zoomen (`readablePps`): na het herkennen ≈ 32 px per typische afstand tussen aanslagen,
  na het invullen van een tempo minstens 26 px per zestiende. Alleen inzoomen, nooit uitzoomen.
- "Terug naar startpositie bij stoppen" (`lib/appSettings.ts`, `gsm.settings`) zit in
  `useAudioTransport.pause`; een klik tijdens het afspelen wordt de nieuwe startpositie.
- "Tel 1 hier" schuift de maatstrepen; de noten blijven op hun tijd (gedeelde tijdas). Binnen 80 ms van een
  aanslag springt tel 1 op die aanslag.
- `PracticeEngine` plant noten en klikken 150 ms vooruit op `AudioContext.currentTime` (timer 25 ms,
  nooit setTimeout voor de timing zelf). De UI vraagt in `useFrame` `position()` op (met output-latency)
  en tekent alleen de highlight-canvassen opnieuw als de klinkende noot wisselt. Een herhaling wordt
  aangevuld met rusten tot hele maten. Een nieuwe noot op een snaar kapt de vorige af; arpeggio's klinken
  door, toonladders legato.
- Het instrument zit achter `Instrument.play(midi, snaar, tijd, duur)`, zodat samples later kunnen.
- De notenbalk in Techniek is een eigen tekening (`technique/drawScore.ts`), niet de Meespelen-tijdas:
  de speler is nog niet echt gedeeld tussen de modi.

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
- Techniek is getest in headless Chromium: toonhoogte van de Karplus-Strong-snaar (offline gerenderd,
  E2 tot E6 binnen 1 cent), voortellen, highlight in notenbalk, tab en hals, 4 noten per snaar, B♭7-arpeggio
  in triolen, patroon 1 2 3 7, heletoons met één positie, telefoonbreedte. Het geluid en de timing zijn niet
  beluisterd; de synchronisatie op een echt apparaat (output-latency, Bluetooth) is niet gecontroleerd.
- Stap 3 is getest in headless Chromium op hetzelfde bestand: 4/4 en 3/4, tikken, inzoomen, telefoonbreedte.
  Nootkoppen vallen binnen een paar pixels op hun aanslag. Niet geprobeerd: lange stukken, snelle loopjes,
  echte opnames.
