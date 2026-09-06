// Small helpers that keep derived values out of content files.
//
// Lot codes (`GRO·EM·1`) are always computed from parts — the *distillation*
// place's stateAbbr, a lot's codeAgave, and its codeNumber — never authored
// as a single string. This is the one place that assembles them, so the
// separator/format only needs to change once.
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { Locale } from '../i18n/routes';

const CODE_SEPARATOR = '·'; // "·" MIDDLE DOT

/**
 * Assemble the display lot code from its parts: the distillation state, the
 * agave, and the lot's number *within that state* (`codeNumber`).
 *
 * The final segment used to be the two-digit harvest year, which made the
 * code restate a fact the COSECHA row already shows, and made the espadín
 * lot render "GRO·EM·23" under the URL `/lote/gro-em-26/`. Numbering the lot
 * per state instead gives each palenque its own run — GRO·EM·1, GRO·CP·2,
 * OAX·CY·1, OAX·MX·2 — and leaves the vintage to the one row that states it.
 *
 * @example lotCode('GRO', 'EM', 1) // "GRO·EM·1"
 */
export function lotCode(stateAbbr: string, codeAgave: string, codeNumber: number): string {
  return [stateAbbr, codeAgave, String(codeNumber)].join(CODE_SEPARATOR);
}

/**
 * Convenience overload that resolves a lot code straight from a lot entry.
 * Sources the STATE segment from `palenque` (the distillation site) — that's
 * what "GRO·EM·1" denotes — not from `origin` (where the agave grew), which
 * can be a different place entirely. `codeNumber` is scoped to that same
 * state, so it is authored per lot rather than derived here.
 */
export async function lotCodeForEntry(lot: CollectionEntry<'lots'>): Promise<string> {
  const palenque = await getEntry(lot.data.palenque);
  if (!palenque) {
    throw new Error(`Lot "${lot.id}" references a palenque (distillation place) that could not be resolved.`);
  }
  return lotCode(palenque.data.stateAbbr, lot.data.codeAgave, lot.data.codeNumber);
}

/**
 * Whether a lot's agave was grown and distilled at the same place. The page
 * layer branches on this for both the map (one marker vs. two) and the meta
 * row (one locality chip vs. two names). Compares by reference id, not by
 * resolving both entries, so it's cheap to call from a template that hasn't
 * otherwise dereferenced either place.
 */
export function isSameOriginAndPalenque(lot: CollectionEntry<'lots'>): boolean {
  return lot.data.origin.id === lot.data.palenque.id;
}

/**
 * The one-line locality for a lot — the landing row, the lot hero meta row,
 * the map caption, and the OG card all show exactly this string, computed
 * once here rather than copy-pasted at four call sites (that duplication is
 * exactly the kind that drifts: an earlier version of this codebase had the
 * same ternary written out four times).
 *
 * When the agave grew where it was distilled, name that place. When the two
 * differ — Espadín—Mexicano is grown in Telixtac and distilled in Pachivia;
 * Coyote is grown in Palo Grande and distilled in La Chaga — naming only one
 * of them would misrepresent the lot, so both are named: the origin plainly,
 * the palenque with its full label (name, municipality, state).
 */
export function lotLocality(
  origin: CollectionEntry<'places'>,
  palenque: CollectionEntry<'places'>,
): string {
  if (origin.id === palenque.id) return placeLabel(palenque);
  return `${origin.data.name} · ${placeLabel(palenque)}`;
}

/**
 * Derive a place's display string as "Name, Municipality, State" (dropping
 * municipality when unset) unless the place sets an explicit `label`
 * override. Keeps composition logic in one place rather than duplicated
 * across every content entry.
 */
export function placeLabel(place: CollectionEntry<'places'>): string {
  if (place.data.label) return place.data.label;
  const parts = [place.data.name, place.data.municipality, place.data.state].filter(
    (part): part is string => Boolean(part),
  );
  return parts.join(', ');
}

/** Look up a lot's per-locale prose by slug (the lot's id in the `lots` collection). */
export function getLotProse(slug: string, locale: Locale) {
  return getEntry('lotProse', `${slug}/${locale}`);
}

/** All lots in landing/next-lot order. */
export async function getOrderedLots(): Promise<CollectionEntry<'lots'>[]> {
  const all = await getCollection('lots');
  return all.sort((a, b) => a.data.order - b.data.order);
}
