# Guitar Study Mate

Een webapp om gitaarfragmenten te bestuderen: een opname laden, een stukje loopen,
vertragen zonder dat de toonhoogte verandert, en later meelezen in notatie en tab.

Klaar zijn **stap 1** (de audio-lane met upload en bediening) en **stap 2** (noten herkennen met Basic Pitch).

## Starten

```bash
npm install
npm run dev      # ontwikkelen
npm run build    # productiebuild naar dist/
npm run preview  # de build lokaal bekijken
```

Stack: Vite, React 19, TypeScript en Chakra UI 3. Lettertypen (Newsreader en
Instrument Sans) komen via `@fontsource`, dus er wordt niets van externe servers geladen.

## Wat het nu kan

- **Upload**: kies een bestand of sleep het ergens op het venster (WAV, MP3, M4A, OGG, FLAC, tot 15 minuten). Het bestand blijft in je browser.
- **Golfvorm** met tijdlineaal. Het gespeelde deel licht op, de rest blijft gedempt.
- **Afspeelkop** die over de hele lane loopt. Klik om te zoeken.
- **Loop**: sleep over de golfvorm om een loop te maken, of pak de locators in de lineaal om hem bij te stellen.
- **Snelheid** van 0,25× tot 2× met behoud van toonhoogte, plus presets.
- **Zoom** met de knoppen of Ctrl/⌘ + scrollen, en een knop om de afspeelkop te laten volgen.
- **Noten herkennen**: de knop boven de lanes laat [Basic Pitch](https://github.com/spotify/basic-pitch)
  in een worker de noten uit de opname halen. Ze verschijnen als pianorol in de notenlane onder de
  golfvorm, op dezelfde tijdas, met de zes open snaren als hulplijnen. Het gespeelde deel licht op.
  Met de downloadknop sla je de noten op als JSON (`{ start, duration, midi, amplitude }`, in seconden).

### Sneltoetsen

| Toets | Actie |
| --- | --- |
| Spatie | afspelen of pauzeren |
| ← → | 1 seconde terug of vooruit (met Shift: 5 seconden) |
| Home | naar het begin, of naar het begin van de loop |
| L | loop aan of uit |
| [ en ] | loop begint of eindigt op de afspeelkop |
| , en . | langzamer of sneller, in stappen van 0,05× |

## Opbouw

```
src/
  audio/
    useAudioTransport.ts   afspelen, loop, snelheid, volume, laden
    decode.ts, peaks.ts    decoderen en pieken berekenen voor de golfvorm
  transcription/
    useTranscription.ts    start en stopt de worker, houdt status en noten bij
    basicPitch.worker.ts   TF.js + Basic Pitch, van samples naar noot-events
    resample.ts            opnieuw decoderen op 22,05 kHz mono
    notes.ts, types.ts     notennamen, JSON-export, berichtvormen van de worker
  components/
    timeline/              de gedeelde tijdas
      Timeline.tsx         scroll, zoom, afspeelkop, klikken en slepen
      drawing.ts           lineaal, golfvorm en pianorol op canvas
      LoopHandle.tsx       versleepbare loop-locators
      useWindowedCanvas.ts canvas ter grootte van het venster, tekent alleen wat zichtbaar is
    TransportBar.tsx       bediening onder de lane
    UploadDropzone.tsx     lege toestand
  theme/                   Chakra-systeem, kleuren en texturen
  hooks/                   sneltoetsen, bestanden slepen, animatieframe
```

### De gedeelde tijdas

Alles in de timeline gebruikt één regel: **x = tijd × pixels per seconde**. Alle lanes
staan in dezelfde horizontaal scrollende container, dus de afspeelkop en de loop lopen
vanzelf dwars door elke lane heen. Een nieuwe lane (notatie, tab) komt als zusje van de
golfvorm-canvassen in `Timeline.tsx` te staan en krijgt een koptekst in de lane-kolom links.

De afspeelkop en de klok schrijven rechtstreeks naar de DOM in een `requestAnimationFrame`-lus,
zodat afspelen geen React-renders veroorzaakt.

### Het thema

De kleuren komen uit de referentiefoto's: espresso en walnoot van de oefenruimte, messing
van bekkens en stekkers, het kersrood van de ES-335-sunburst en de tweed van de versterker.
Ze staan in `src/theme/palette.ts` en worden zowel door Chakra als door de canvastekening gebruikt.

## Bekende grenzen

- Maximaal 15 minuten per bestand. De hele opname wordt eenmalig gedecodeerd voor de golfvorm.
- Op een touchscreen maak je een loop met de Loop-knop en versleep je daarna de locators. Slepen over de golfvorm scrolt daar de lane.
- Het gedecodeerde geluid wordt na het berekenen van de pieken niet bewaard. De transcriptiestap decodeert opnieuw, op 22,05 kHz mono.
- Notenherkenning werkt voor solo gitaar. Bij een volledige mix moet de gitaar eerst gescheiden worden.
- Basic Pitch geeft ook boventonen als losse, zachtere noten (vaak een octaaf of duodecime boven de echte noot). Die worden nog niet weggefilterd; dat hoort bij het handmatig corrigeren.
- Geheugen: de bibliotheek houdt de modeluitvoer vast als geneste JS-arrays (88 waarden per frame, 86 frames per seconde). De contours (voor pitch bends) slaan we over, maar frames en onsets samen kosten bij 15 minuten nog ruim 100 MB in de worker.
- Zonder bruikbare WebGL valt de worker terug op de CPU. Dat is ongeveer anderhalf keer zo traag als realtime; 15 minuten duurt dan lang.
- Het model (ongeveer 900 kB, Apache-2.0) staat in `public/models/basic-pitch/`. De worker is ongeveer 1,8 MB en wordt pas geladen bij de eerste herkenning.

## Volgende stappen

1. Notatielane (VexFlow) op dezelfde tijdas.
2. Tab-lane: noten naar snaar en fret met dynamic programming.
3. Handmatig corrigeren van noten en frets.
