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

/** The locale a built page is in, from its path: `/en/...` is English. */
export function localeOf(path: string): 'es' | 'en' {
  return path === '/en/' || path.startsWith('/en/') ? 'en' : 'es';
}

/**
 * The Spanish counterpart of a path and vice versa — the pairing the language
 * toggle and the hreflang tags have to agree on. Mirrors `pagePath()` in
 * src/i18n/routes.ts, deliberately reimplemented here rather than imported:
 * a test that shares the implementation it checks proves nothing.
 */
export function counterpartOf(path: string): string {
  if (path === '/') return '/en/';
  if (path === '/en/') return '/';
  const en = path.match(/^\/en\/lot\/(.+)\/$/);
  if (en) return `/lote/${en[1]}/`;
  const es = path.match(/^\/lote\/(.+)\/$/);
  if (es) return `/en/lot/${es[1]}/`;
  if (path === '/nosotros/') return '/en/about/';
  if (path === '/en/about/') return '/nosotros/';
  throw new Error(`No counterpart rule for "${path}" — add one when a page shape is added.`);
}

/**
 * 360 (common Android), 768 (tablet) and 1280 (desktop).
 *
 * Plan §6b listed five. 375 (iPhone SE/mini) and 390 (modern iPhone) were
 * dropped on 2026-09-05: 360 is the tighter bracket, so anything that fits
 * there fits both, and the suite now runs one page load per page per width —
 * two extra phone widths cost three full loads a page and caught nothing 360
 * did not.
 */
export const VIEWPORTS = [360, 768, 1280] as const;

/** Widths at which the mobile type floor applies (plan §6b item 7). */
export const MOBILE_WIDTHS = VIEWPORTS.filter((width) => width <= 390);

export const VIEWPORT_HEIGHT = 844;

/** The minimum touch target, in CSS pixels (plan §6b item 6). */
export const MIN_TAP = 44;

/** The mobile type floor, in CSS pixels (plan §6b item 7). */
export const MIN_FONT_SIZE = 12;
