/**
 * Open Graph cards, one per page, emitted as real files by the static build.
 *
 * An endpoint rather than a build integration so the cards are derived from
 * the same content collections as the pages themselves — a new lot produces
 * its own card with no extra step, and a dangling reference fails here for
 * the same reason it fails on the page (plan §3c).
 *
 * Routes: /og/site.png (landing) and /og/<lot-slug>.png.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getEntry } from 'astro:content';
import { renderCard, type CardSpec } from '../../lib/og';
import {
  getOrderedLots,
  isSameOriginAndPalenque,
  lotCode,
  microloteLabel,
  placeLabel,
} from '../../lib/lot';

/** The landing card borrows the first lot's hue so the set reads as one family. */
const SITE_SLUG = 'site';

export const getStaticPaths = (async () => {
  const lots = await getOrderedLots();

  const lotRoutes = await Promise.all(
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
        eyebrow: microloteLabel(lot.data.number),
        code: lotCode(palenque.data.stateAbbr, lot.data.codeAgave, lot.data.harvestYear),
        name: agave.data.commonName,
        locality: locality.toUpperCase(),
        harvest: `COSECHA ${lot.data.harvestYear}`,
        accentHue: lot.data.accentHue,
      };
      return { params: { slug: lot.id }, props: { card } };
    }),
  );

  const first = lots[0];
  const siteCard: CardSpec = {
    kind: 'site',
    lede: 'Destilado de agave',
    tagline: 'BARBECHO — LABRAR LA TIERRA Y DEJARLA DESCANSAR',
    accentHue: first ? first.data.accentHue : 40,
  };

  return [{ params: { slug: SITE_SLUG }, props: { card: siteCard } }, ...lotRoutes];
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
