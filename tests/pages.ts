import { readFileSync } from 'node:fs';

/**
 * The pages under test, read out of the built sitemap rather than listed here.
 *
 * A hardcoded list silently stops covering a lot the day someone adds one —
 * which is exactly when the mobile assertions matter most. The sitemap is
 * generated from the same routes the build emitted, so this list is the
 * shipped site by construction.
 */
const SITEMAP = 'dist/sitemap-0.xml';

export const PAGE_PATHS: string[] = (() => {
  let xml: string;
  try {
    xml = readFileSync(SITEMAP, 'utf8');
  } catch {
    throw new Error(
      `${SITEMAP} not found. The suite runs against the built site — run \`npm run build\` first (or \`npm run verify\`).`,
    );
  }
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => new URL(match[1]!).pathname,
  );
  if (paths.length === 0) {
    throw new Error(`${SITEMAP} listed no pages.`);
  }
  return paths.sort();
})();

/**
 * Plan §6b: 360 (common Android), 375 (iPhone SE/mini), 390 (modern iPhone),
 * 768 (tablet) and 1280 (desktop).
 */
export const VIEWPORTS = [360, 375, 390, 768, 1280] as const;

/** Widths at which the mobile type floor applies (plan §6b item 7). */
export const MOBILE_WIDTHS = VIEWPORTS.filter((width) => width <= 390);

export const VIEWPORT_HEIGHT = 844;

/** The minimum touch target, in CSS pixels (plan §6b item 6). */
export const MIN_TAP = 44;

/** The mobile type floor, in CSS pixels (plan §6b item 7). */
export const MIN_FONT_SIZE = 12;
