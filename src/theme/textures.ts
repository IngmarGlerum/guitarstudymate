const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/**
 * Soft horizontal streaks, like the walnut panelling in the practice room.
 * stitchTiles makes the 640×260 tile seamless; the alpha stays low so it reads
 * as a material, not as noise.
 */
export const woodGrain = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="260">
    <filter id="g" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.0025 0.11" numOctaves="3" seed="11" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.36  0 0 0 0 0.16  0 0 0 0.44 -0.12"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#g)"/>
  </svg>`,
);

/** Amp tweed: a fine twill over a warm cream. */
export const tweedTwill =
  'repeating-linear-gradient(45deg, rgba(255,240,196,0.16) 0 1px, transparent 1px 3px),' +
  'repeating-linear-gradient(-45deg, rgba(40,24,8,0.30) 0 1px, transparent 1px 3px)';

/** Amp grille cloth: horizontal ribs. */
export const grilleRibs =
  'repeating-linear-gradient(0deg, rgba(0,0,0,0.38) 0 2px, rgba(255,214,150,0.045) 2px 4px)';
