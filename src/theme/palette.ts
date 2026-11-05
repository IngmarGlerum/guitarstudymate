/**
 * Raw colours, sampled from the reference photos:
 * the walnut-panelled live room and stage light of the drum stills,
 * brass cymbals and jack plugs, the ES-335 sunburst, tweed amp cloth.
 * Chakra tokens and the canvas drawing code both read from here.
 */
export const palette = {
  // room
  espresso: '#140d09',
  walnut: '#1c130d',
  mahogany: '#281b12',
  oak: '#3b2b1d',
  oakLight: '#54402d',

  // type
  parchment: '#f1e6cc',
  parchmentMuted: '#bfae8e',
  parchmentFaint: '#8f7f66',

  // stage light + metal
  honey: '#f0b45a',
  honeyLight: '#f6d28f',
  brass: '#d9a441',
  brassDeep: '#9a6c22',

  // ES-335 sunburst edge
  cherry: '#c9492f',
  cherryDeep: '#8a2a1b',

  // tweed cabinet trim
  tweed: '#a8935a',

  // unplayed waveform
  dimEdge: '#5a4330',
  dimCore: '#85653f',
} as const;

const scale = (values: Record<string, string>) =>
  Object.fromEntries(Object.entries(values).map(([k, value]) => [k, { value }]));

/** warm brown neutrals, replaces Chakra's gray */
export const grayScale = scale({
  50: '#f6efe2',
  100: '#ecdfc7',
  200: '#d9c8a6',
  300: '#bda985',
  400: '#9b8767',
  500: '#7a6851',
  600: '#5d4e3c',
  700: '#463a2c',
  800: '#31271d',
  900: '#221a13',
  950: '#17110c',
});

export const brassScale = scale({
  50: '#fbf3dc',
  100: '#f6e4b3',
  200: '#efd083',
  300: '#e6bb59',
  400: '#d9a441',
  500: '#bf8a2d',
  600: '#9a6c22',
  700: '#75521d',
  800: '#533a17',
  900: '#382710',
  950: '#1f160a',
});

export const cherryScale = scale({
  50: '#fcebe6',
  100: '#f7cfc4',
  200: '#ec9f8a',
  300: '#de7258',
  400: '#c9492f',
  500: '#a93522',
  600: '#8a2a1b',
  700: '#6c2216',
  800: '#4f1a11',
  900: '#35120c',
  950: '#200a07',
});
