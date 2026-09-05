/**
 * Locales and the URL shapes that belong to them.
 *
 * `astro.config.mjs` declares `locales: ['es','en']`, `defaultLocale: 'es'`,
 * `prefixDefaultLocale: false` — so Spanish serves from `/` and English from
 * `/en/`. Astro's i18n config governs routing *conventions*; it does not
 * generate the paths for us, because the two locales deliberately use
 * different words for the lot segment (`/lote/` vs `/lot/`). That is a
 * content decision, not a routing one, so it lives here.
 *
 * Counterpart URLs are *derived from the page's identity*, never by rewriting
 * the current pathname. A string rewrite (`/lote/` -> `/en/lot/`) would be a
 * second, silently divergent definition of the route table: add a page shape
 * and the rewrite keeps "working" while pointing at a 404. `PageRef` makes
 * every page name what it is, and `alternatePaths()` is then total — every
 * page has both localizations by construction.
 */

export const LOCALES = ['es', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/** The locale served from `/` (astro.config.mjs `defaultLocale`). */
export const DEFAULT_LOCALE: Locale = 'es';

/** The other locale. Exhaustive over a two-locale set. */
export function otherLocale(locale: Locale): Locale {
  return locale === 'es' ? 'en' : 'es';
}

/**
 * What a page *is*, independent of locale. Every route in the site is one of
 * these; adding a route shape adds a variant here and the compiler then
 * requires a path for it in both locales.
 */
export type PageRef =
  | { kind: 'home' }
  | { kind: 'lot'; slug: string }
  | { kind: 'about' };

/** BCP 47 tags for `<html lang>`. */
export const HTML_LANG: Record<Locale, string> = {
  es: 'es',
  en: 'en',
};

/** Open Graph locale tags. */
export const OG_LOCALE: Record<Locale, string> = {
  es: 'es_MX',
  en: 'en_US',
};

/** The root-relative path of a page in a given locale. Always trailing-slashed. */
export function pagePath(ref: PageRef, locale: Locale): string {
  switch (ref.kind) {
    case 'home':
      return locale === 'es' ? '/' : '/en/';
    case 'lot':
      /* The segment itself is localized: `lote` in Spanish, `lot` in English.
         Deliberate — a URL is read by people, and a Spanish path under an
         English page reads as a mistake. */
      return locale === 'es' ? `/lote/${ref.slug}/` : `/en/lot/${ref.slug}/`;
    case 'about':
      return locale === 'es' ? '/nosotros/' : '/en/about/';
  }
}

/** Both localizations of a page, for hreflang and the language toggle. */
export function alternatePaths(ref: PageRef): Record<Locale, string> {
  return { es: pagePath(ref, 'es'), en: pagePath(ref, 'en') };
}

/**
 * Where a page's Open Graph card lives. Cards carry words, so they are per
 * locale too: `/og/site.png` and `/og/en/site.png`.
 *
 * A `switch`, like `pagePath` above, rather than a `ref.kind === 'home' ? ...
 * : ref.slug` ternary: a ternary silently returns `undefined` (`ref.slug` on
 * a kind that has none) for a `PageRef` variant it doesn't know about,
 * where a switch with no default fails to compile until every case is
 * handled — the same "adding a page shape forces every route function to
 * catch up" property `pagePath` already has.
 */
export function ogPath(ref: PageRef, locale: Locale): string {
  const slug = ((): string => {
    switch (ref.kind) {
      case 'home':
        return 'site';
      case 'lot':
        return ref.slug;
      case 'about':
        return 'about';
    }
  })();
  return locale === 'es' ? `/og/${slug}.png` : `/og/en/${slug}.png`;
}
