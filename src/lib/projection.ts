/**
 * Build-time Mercator projection for the lot map (plan §4).
 *
 * The prototype hardcoded marker positions as percentages (`left:38.9%;
 * top:44.9%`). Those are *derived* values: `design/map-src.html` generated
 * `src/assets/map-base.svg` with
 *
 *   d3.geoMercator().fitExtent([[24, 24], [760 - 24, 470 - 24]], bbox)
 *
 * where `bbox` is the LineString `[[-106.5, 13.4], [-89.5, 23.2]]`, rendered
 * at 760x470 and then cropped to `viewBox="60 110 660 280"`.
 *
 * This module reproduces that arithmetic in plain TypeScript so a place's
 * `coords` — the only thing content authors state — is the single source of
 * truth for where its marker lands. It is a pure function, evaluated during
 * `astro build`. d3 is neither a dependency nor shipped to the client.
 *
 * Verified against all three published positions by `projection.check.mjs`
 * in this directory:
 *
 *   -99.55, 18.35 -> 38.9%, 44.9%
 *   -99.30, 17.95 -> 40.4%, 51.1%
 *   -96.55, 16.30 -> 57.5%, 76.3%
 */

/** [longitude, latitude] in degrees — the shape of `places.coords`. */
export type Coords = readonly [number, number];

/** A projected position, as percentages of the cropped viewBox. */
export interface MapPosition {
  /** Distance from the map's left edge, 0-100 (may fall outside for points off-map). */
  x: number;
  /** Distance from the map's top edge, 0-100. */
  y: number;
}

/* --- The exact parameters `map-src.html` drew the base map with ----------- */

/** Canvas the base map was rendered at, before cropping. */
const RENDER_WIDTH = 760;
const RENDER_HEIGHT = 470;
/** `fitExtent` inset on every side. */
const INSET = 24;
/** The LineString `fitExtent` was fitted to: [[west, south], [east, north]]. */
const BBOX: readonly [Coords, Coords] = [
  [-106.5, 13.4],
  [-89.5, 23.2],
];
/** The crop the published SVG carries: `viewBox="60 110 660 280"`. */
const VIEWBOX = { x: 60, y: 110, width: 660, height: 280 } as const;

/** Aspect ratio of the cropped map, for the component's `aspect-ratio`. */
export const MAP_ASPECT_RATIO = `${VIEWBOX.width}/${VIEWBOX.height}`;

const DEG_TO_RAD = Math.PI / 180;

/** Spherical Mercator, unscaled (d3's raw projection, at scale 1). */
function mercatorX(lon: number): number {
  return lon * DEG_TO_RAD;
}
function mercatorY(lat: number): number {
  // Negated so y grows downward, as d3 does when it applies scale/translate.
  return -Math.log(Math.tan(Math.PI / 4 + (lat * DEG_TO_RAD) / 2));
}

/*
 * `fitExtent` fits the *bounds* of the projected bbox. Because mercatorY is
 * monotonically decreasing in latitude, the bounds' top-left is
 * (west, north) and its bottom-right is (east, south).
 */
const MIN_X = mercatorX(BBOX[0][0]);
const MAX_X = mercatorX(BBOX[1][0]);
const MIN_Y = mercatorY(BBOX[1][1]);
const MAX_Y = mercatorY(BBOX[0][1]);

const EXTENT_WIDTH = RENDER_WIDTH - 2 * INSET;
const EXTENT_HEIGHT = RENDER_HEIGHT - 2 * INSET;

/** Uniform scale: whichever axis is the binding constraint. */
const SCALE = Math.min(EXTENT_WIDTH / (MAX_X - MIN_X), EXTENT_HEIGHT / (MAX_Y - MIN_Y));

/** Translation that centres the scaled bounds inside the inset extent. */
const TRANSLATE_X = INSET + (EXTENT_WIDTH - SCALE * (MAX_X + MIN_X)) / 2;
const TRANSLATE_Y = INSET + (EXTENT_HEIGHT - SCALE * (MAX_Y + MIN_Y)) / 2;

/**
 * Project `[lon, lat]` into the 760x470 render canvas the base map was drawn
 * on. Exported mainly so the check script can assert the intermediate step.
 */
export function projectToCanvas([lon, lat]: Coords): { x: number; y: number } {
  return {
    x: SCALE * mercatorX(lon) + TRANSLATE_X,
    y: SCALE * mercatorY(lat) + TRANSLATE_Y,
  };
}

/**
 * Project `[lon, lat]` to a position within the *cropped* map, as percentages
 * of its width and height — directly usable as CSS `left` / `top` on an
 * overlay sized to the base map.
 */
export function project(coords: Coords): MapPosition {
  const { x, y } = projectToCanvas(coords);
  return {
    x: ((x - VIEWBOX.x) / VIEWBOX.width) * 100,
    y: ((y - VIEWBOX.y) / VIEWBOX.height) * 100,
  };
}

/**
 * Whether a projected position actually falls inside the cropped map. A place
 * outside southern Mexico would otherwise be drawn hanging off the edge; the
 * component uses this to drop such a marker rather than render nonsense.
 */
export function isOnMap({ x, y }: MapPosition): boolean {
  return x >= 0 && x <= 100 && y >= 0 && y <= 100;
}

/** Round to the precision the design published its percentages at. */
export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}
