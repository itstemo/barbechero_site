/**
 * Open Graph cards, one per page, emitted as real files by the static build.
 *
 * An endpoint rather than a build integration so the cards are derived from
 * the same content collections as the pages themselves — a new lot produces
 * its own card with no extra step, and a dangling reference fails here for
 * the same reason it fails on the page (plan §3c).
 *
 * Routes: /og/site.png (landing) and /og/<lot-slug>.png, plus the English
 * set under /og/en/. The cards carry words — "MICROLOTE 01", "COSECHA 2026",
 * the site lede — so they are drawn per locale rather than shared; the paths
 * come from `ogPath()`, the same function the page's <meta og:image> uses.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getEntry } from 'astro:content';
import { renderCard, type CardSpec } from '../../lib/og';
import { LOCALES, ogPath, type Locale, type PageRef } from '../../i18n/routes';
import { t, ui } from '../../i18n/ui';
import {
  getOrderedLots,
  isSameOriginAndPalenque,
  lotCode,
  placeLabel,
} from '../../lib/lot';

/**
 * The route param, derived from the card's own URL so the endpoint and the
 * pages cannot disagree about where a card lives: `/og/en/site.png` means
 * `slug` is `en/site`.
 */
function slugFor(ref: PageRef, locale: Locale): string {
  return ogPath(ref, locale).replace(/^\/og\//, '').replace(/\.png$/, '');
}

export const getStaticPaths = (async () => {
  const lots = await getOrderedLots();

  const lotRoutes = await Promise.all(
    LOCALES.flatMap((locale) =>
      lots.map(async (lot) => {
        const [agave, palenque] = await Promise.all([
          getEntry(lot.data.agave),
          getEntry(lot.data.palenque),
        ]);
        if (!agave) {
          throw new Error(`OG card for "${lot.id}": agave "${lot.data.agave.id}" did not resolve.`);
        }
        if (!palenque) {
          throw new Error(
            `OG card for "${lot.id}": palenque "${lot.data.palenque.id}" did not resolve.`,
          );
        }

        /* Same caption rule as the page and the map (plan §3b). */
        const region = palenque.data.region;
        const locality =
          !isSameOriginAndPalenque(lot) && region
            ? `${region}, ${palenque.data.state}`
            : placeLabel(palenque);

        const card: CardSpec = {
          kind: 'lot',
          eyebrow: t(ui.lot.microlot, locale, lot.data.number),
          code: lotCode(palenque.data.stateAbbr, lot.data.codeAgave, lot.data.harvestYear),
          name: agave.data.commonName,
          locality: locality.toUpperCase(),
          harvest: t(ui.lot.harvestYear, locale, lot.data.harvestYear),
          accentHue: lot.data.accentHue,
        };
        return {
          params: { slug: slugFor({ kind: 'lot', slug: lot.id }, locale) },
          props: { card },
        };
      }),
    ),
  );

  const first = lots[0];
  const siteRoutes = LOCALES.map((locale) => {
    const card: CardSpec = {
      kind: 'site',
      lede: t(ui.home.lede, locale),
      tagline: t(ui.home.tagline, locale),
      accentHue: first ? first.data.accentHue : 40,
    };
    return { params: { slug: slugFor({ kind: 'home' }, locale) }, props: { card } };
  });

  return [...siteRoutes, ...lotRoutes];
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { card } = props as { card: CardSpec };
  const png = await renderCard(card);
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
