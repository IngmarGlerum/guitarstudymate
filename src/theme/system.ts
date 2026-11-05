import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';
import { brassScale, cherryScale, grayScale, palette as p } from './palette';
import { woodGrain } from './textures';

const config = defineConfig({
  globalCss: {
    html: { colorScheme: 'dark' },
    body: {
      bg: 'bg',
      color: 'fg',
      fontFamily: 'body',
      minHeight: '100dvh',
      // stage light falling from above, plus faint wainscot panel lines
      backgroundImage: [
        'radial-gradient(1200px 560px at 50% -120px, rgba(240,180,90,0.17), transparent 72%)',
        'repeating-linear-gradient(90deg, transparent 0 279px, rgba(0,0,0,0.22) 279px 280px)',
      ].join(','),
      backgroundRepeat: 'no-repeat, repeat',
    },
    '::selection': { background: 'rgba(217,164,65,0.35)' },
    '*:focus-visible': { outline: `2px solid ${p.honey}`, outlineOffset: '2px' },
    '*': {
      scrollbarColor: `${p.oakLight} ${p.walnut}`,
      '@media (prefers-reduced-motion: reduce)': {
        transitionDuration: '0.01ms !important',
        animationDuration: '0.01ms !important',
      },
    },
    ':root': { '--wood-grain': woodGrain },
  },
  theme: {
    tokens: {
      fonts: {
        heading: { value: "'Newsreader Variable', Georgia, 'Times New Roman', serif" },
        body: { value: "'Instrument Sans Variable', system-ui, -apple-system, 'Segoe UI', sans-serif" },
      },
      colors: {
        gray: grayScale,
        brass: brassScale,
        cherry: cherryScale,
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: { value: p.espresso },
          subtle: { value: '#1a120c' },
          muted: { value: p.mahogany },
          emphasized: { value: '#34261a' },
          panel: { value: p.walnut },
          inverted: { value: p.parchment },
        },
        fg: {
          DEFAULT: { value: p.parchment },
          muted: { value: p.parchmentMuted },
          subtle: { value: p.parchmentFaint },
          inverted: { value: p.espresso },
        },
        border: {
          DEFAULT: { value: p.oak },
          muted: { value: '#2c2118' },
          subtle: { value: '#241a12' },
          emphasized: { value: p.oakLight },
        },
        gray: {
          contrast: { value: p.espresso },
          fg: { value: p.parchment },
          subtle: { value: '#2a1e15' },
          muted: { value: '#34261a' },
          emphasized: { value: '#44332a' },
          solid: { value: p.parchment },
          focusRing: { value: p.honey },
          border: { value: p.oak },
        },
        brass: {
          contrast: { value: p.espresso },
          fg: { value: '{colors.brass.300}' },
          subtle: { value: '{colors.brass.900}' },
          muted: { value: '{colors.brass.800}' },
          emphasized: { value: '{colors.brass.700}' },
          solid: { value: '{colors.brass.400}' },
          focusRing: { value: '{colors.brass.300}' },
          border: { value: '{colors.brass.600}' },
        },
        cherry: {
          contrast: { value: '#fff4e6' },
          fg: { value: '{colors.cherry.300}' },
          subtle: { value: '{colors.cherry.900}' },
          muted: { value: '{colors.cherry.800}' },
          emphasized: { value: '{colors.cherry.700}' },
          solid: { value: '{colors.cherry.500}' },
          focusRing: { value: '{colors.cherry.300}' },
          border: { value: '{colors.cherry.600}' },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
