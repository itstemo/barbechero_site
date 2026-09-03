/**
 * Minimal ambient types for the two build-time font libraries.
 *
 * `opentype.js` 2.0 and `wawoff2` 2.0 both ship without type declarations.
 * Only the handful of members the Open Graph card renderer actually uses are
 * declared here — a narrow surface is better than `any` on the whole module,
 * and it keeps `astro check` at zero errors under `strict`.
 *
 * Neither package reaches the browser: they are used only inside
 * `src/lib/og.ts`, which runs in the static endpoint at build time.
 */

declare module 'opentype.js' {
  export interface RenderOptions {
    kerning?: boolean;
    /** Extra tracking, as a fraction of the font size. */
    letterSpacing?: number;
    features?: Record<string, boolean>;
  }

  export type PathCommand =
    | { type: 'M'; x: number; y: number }
    | { type: 'L'; x: number; y: number }
    | { type: 'Q'; x1: number; y1: number; x: number; y: number }
    | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
    | { type: 'Z' };

  export interface Path {
    commands: PathCommand[];
    toPathData(decimalPlaces?: number): string;
  }

  export interface Font {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    getPath(
      text: string,
      x: number,
      y: number,
      fontSize: number,
      options?: RenderOptions,
    ): Path;
    getAdvanceWidth(text: string, fontSize: number, options?: RenderOptions): number;
  }

  export function parse(buffer: ArrayBuffer): Font;
}

declare module 'wawoff2' {
  /** WOFF2 -> TTF. Returns the raw SFNT bytes. */
  export function decompress(input: Uint8Array): Promise<Uint8Array>;
}
