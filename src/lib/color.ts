/**
 * Oklch -> sRGB, for build-time raster output only.
 *
 * The site itself never needs this: every accent is written as
 * `oklch(0.52 0.11 var(--accent-hue))` and the browser resolves it (plan §1).
 * But the Open Graph cards are rasterised by librsvg inside sharp, which does
 * not understand `oklch()`, so the one accent on a card has to be handed over
 * as a hex. Deriving it here keeps the single-number-per-lot rule intact —
 * still no hex anywhere in content or CSS.
 *
 * Conversion is the standard Oklab matrix pair (Björn Ottosson). The site's
 * accents — L 0.52, C 0.11 — are well inside sRGB at every hue, so the final
 * clamp never actually bites; it is there so an out-of-gamut future accent
 * degrades instead of emitting a malformed colour.
 */

/** Linear-light channel -> sRGB, then to a 0–255 byte. */
function encodeChannel(linear: number): number {
  const clamped = Math.min(1, Math.max(0, linear));
  const srgb =
    clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(srgb * 255);
}

/**
 * @param lightness Oklab L, 0–1.
 * @param chroma    Oklch C.
 * @param hue       Oklch H, in degrees.
 * @returns `#rrggbb`.
 */
export function oklchToHex(lightness: number, chroma: number, hue: number): string {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return (
    '#' +
    [red, green, blue]
      .map((channel) => encodeChannel(channel).toString(16).padStart(2, '0'))
      .join('')
  );
}

/** The site's accent ramp: same L and C at every hue, per plan §1. */
export const ACCENT_LIGHTNESS = 0.52;
export const ACCENT_CHROMA = 0.11;

/** `--accent` for a given `--accent-hue`, as a hex sRGB triplet. */
export function accentHex(hue: number): string {
  return oklchToHex(ACCENT_LIGHTNESS, ACCENT_CHROMA, hue);
}
