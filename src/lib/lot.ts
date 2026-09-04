// Small helpers that keep derived values out of content files.
//
// Lot codes (`GRO·EM·26`) are always computed from parts — the *distillation*
// place's stateAbbr, a lot's codeAgave, and a lot's harvestYear — never
// authored as a single string. This is the one place that assembles them, so
// the separator/format only needs to change once.
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { Locale } from '../i18n/routes';

const CODE_SEPARATOR = '·'; // "·" MIDDLE DOT

/** Two-digit year, e.g. 2026 -> "26". */
export function yy(year: number): string {
  return String(year % 100).padStart(2, '0');
}

/**
 * Assemble the display lot code from its parts.
 *
 * @example lotCode('GRO', 'EM', 2026) // "GRO·EM·26"
 */
export function lotCode(stateAbbr: string, codeAgave: string, harvestYear: number): string {
  return [stateAbbr, codeAgave, yy(harvestYear)].join(CODE_SEPARATOR);
}

/**
 * Convenience overload that resolves a lot code straight from a lot entry.
 * Sources the STATE segment from `palenque` (the distillation site) — that's
 * what "GRO·EM·26" denotes — not from `origin` (where the agave grew), which
 * can be a different place entirely.
 */
export async function lotCodeForEntry(lot: CollectionEntry<'lots'>): Promise<string> {
  const palenque = await getEntry(lot.data.palenque);
  if (!palenque) {
    throw new Error(`Lot "${lot.id}" references a palenque (distillation place) that could not be resolved.`);
  }
  return lotCode(palenque.data.stateAbbr, lot.data.codeAgave, lot.data.harvestYear);
}

/**
 * Whether a lot's agave was grown and distilled at the same place. The page
 * layer branches on this for both the map (one marker vs. two) and the meta
 * row (one locality chip vs. "grown in X, distilled in Y"). Compares by
 * reference id, not by resolving both entries, so it's cheap to call from a
 * template that hasn't otherwise dereferenced either place.
 */
export function isSameOriginAndPalenque(lot: CollectionEntry<'lots'>): boolean {
  return lot.data.origin.id === lot.data.palenque.id;
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
