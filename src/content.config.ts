// Content layer definitions for Barbechero.
//
// Normalized model (see docs/IMPLEMENTATION-PLAN.md §3): a `lots` entry never
// restates place/maestro/agave facts — it only *references* them, so a new
// vintage from a known place and maestro is one small file, and a typo in a
// join target fails the build instead of silently 404ing at runtime.
//
// Locale split: structured data (numbers, refs, coords, image paths) is
// authored once in `_data.yaml` and is locale-independent. Only prose is
// per-locale, in `es.mdx` / `en.mdx`. Those two files carry heading + body
// text for the three narrative sections (El Agave / El Lugar / El Maestro)
// as frontmatter fields rather than raw MDX body content: the design's copy
// is short (one heading + one paragraph per section, no embedded components
// or rich markdown), so plain validated strings are simpler and safer than
// inventing a heading-delimited body-splitting convention for three fixed
// slots — that convention would exist only to be parsed apart again by the
// page layer. The MDX body is left free for any future rich content and is
// not required to be non-empty.
//
// `z` comes from `astro/zod`, not the deprecated re-export on `astro:content`
// (same underlying zod/v4 astro validates schemas with either way).
import { defineCollection, reference } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/**
 * A display string that has to exist in every locale.
 *
 * Structured data (enums, coordinates, hues, years, codes, slugs) stays
 * locale-independent — it is data, not prose. But a handful of *display*
 * strings genuinely live in content rather than in the UI dictionary:
 * `manejoLabel`, `heroTag`, `notes`, `distillationDetail`,
 * `distillationMethod`. They are authored per lot, so they cannot live in
 * src/i18n/ui.ts, and they are read by a human, so they cannot stay Spanish
 * on an English page.
 *
 * Same `{ es, en }` shape as the UI dictionary, and read by the same `t()`
 * helper — one pattern in the codebase, not two. Both keys are required:
 * omitting `en` fails the build at content sync, which is the content-layer
 * equivalent of the type error `ui.ts` produces.
 */
const localized = () =>
  z.object({
    es: z.string().min(1),
    en: z.string().min(1),
  });

const agaves = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/agaves' }),
  schema: z.object({
    /** Display name, e.g. "Espadín — Mexicano", "Cupreata", "Coyote". */
    commonName: z.string().min(1),
    /** e.g. "A. angustifolia × A. rhodacantha", "Agave cupreata". */
    scientificName: z.string().min(1),
    /** Closed set — drives the MANEJO spec row's underlying category. */
    manejo: z.enum(['silvestre', 'cultivado', 'hibrido']),
    /** Free-text display value for the MANEJO spec row, e.g. "Híbrido de sierra". */
    manejoLabel: localized(),
  }),
});

// A `place` is just a location — a field, a hillside, a distillery. It does
// not know what role it plays for any given lot; the lot assigns that (see
// `lots.origin` / `lots.palenque` below). "Palenque" specifically means the
// distillery in mezcal-producing regions, so it would be the wrong word here
// for e.g. an agave field — hence the neutral collection name.
const places = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/places' }),
  schema: z.object({
    /** Place name, e.g. "Telixtac", "Pachivia", "Palo Grande". */
    name: z.string().min(1),
    /** Municipality, e.g. "Miahuatlán". Optional — not every place needs one stated. */
    municipality: z.string().optional(),
    /** Named region, e.g. "Sierra Norte". Optional. */
    region: z.string().optional(),
    /** Full state name, e.g. "Guerrero". */
    state: z.string().min(1),
    /** Lot-code STATE segment, e.g. "GRO", "OAX". Uppercase letters only. */
    stateAbbr: z
      .string()
      .regex(/^[A-Z]{2,4}$/, 'stateAbbr must be 2-4 uppercase letters (e.g. "GRO")'),
    /**
     * [longitude, latitude] in standard geographic ranges. Required — this is
     * the sole input to the build-time Mercator projection that places the
     * map marker (plan §4). Do not store computed percentages here.
     */
    coords: z.tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
    ]),
    /** Which side of the marker the map label is drawn on. Defaults to 'above'. */
    labelPlacement: z.enum(['above', 'below']).default('above'),
    /**
     * Explicit display-string override. Leave unset in the normal case — the
     * page layer derives "Name, Municipality, State" (or "Name, State" when
     * there's no municipality) from the fields above via a helper in
     * src/lib/. Only set this when a place genuinely needs a display string
     * that isn't that composition.
     */
    label: z.string().optional(),
  }),
});

const maestros = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/maestros' }),
  schema: ({ image }) =>
    z.object({
      /** e.g. "Don Roque", "Jairo", "Sozimo Jarquín". */
      name: z.string().min(1),
      /** Title shown before the name in the nav/hero meta chip. */
      honorific: z.string().min(1).default('MTRO.'),
      /**
       * Canonical distillation method, e.g. "Alambique de refrescadera".
       * Optional: not every maestro entry in the source design carries one
       * (Jairo's Cupreata page has no DESTILACIÓN spec row).
       */
      distillationMethod: localized().optional(),
      /**
       * Optional subject image for this maestro. Deliberately *not* named
       * "portrait": none of the three maestros currently have an actual
       * portrait photo on disk — what exists (e.g. gro-em-26's
       * tronco-hueco.jpg) is a still process shot, not a picture of the
       * person, so a name implying a headshot would be misleading. No
       * placeholder default; a page template should treat a missing
       * `image` as "render this section without a media column."
       */
      image: image().optional(),
    }),
});

const lots = defineCollection({
  loader: glob({
    pattern: '*/_data.yaml',
    base: './src/content/lots',
    // Default id would be "<slug>/_data"; a lot's id should just be its slug
    // so `reference('lots')` and the sibling prose collection line up on it.
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: ({ image }) =>
    z.object({
      /** Display order / "MICROLOTE NN". 1-indexed. */
      number: z.number().int().positive(),
      /**
       * Lot-code AGAVE segment, e.g. "EM", "CP", "CY". Combined with the
       * *distillation* place's stateAbbr (`palenque`, not `origin` — see
       * below) and harvestYear by `lotCode()` in src/lib/lot.ts to derive
       * the display code — never store the assembled "GRO·EM·26".
       */
      codeAgave: z
        .string()
        .regex(/^[A-Z]{2,4}$/, 'codeAgave must be 2-4 uppercase letters (e.g. "EM")'),
      /** Same lightness/chroma accent for every lot — only the hue varies. */
      accentHue: z.number().min(0).max(360),
      /** Full harvest year, e.g. 2026. YY for the lot code is derived from this. */
      harvestYear: z.number().int().min(2020).max(2100),
      agave: reference('agaves'),
      /**
       * Where the agave grew. Required, and deliberately not merged with
       * `palenque`: a lot's field and its still are not always the same
       * site (e.g. Espadín—Mexicano is grown in Telixtac and distilled in
       * Pachivia — both Sierra Norte, Guerrero, ~8km apart). When a lot
       * really is grown and distilled at one site, point `origin` and
       * `palenque` at the same place slug — explicit sameness, rather than
       * leaving one of the two optional, so "same place" is never
       * ambiguous with "unknown." Use `isSameOriginAndPalenque()` in
       * src/lib/lot.ts to branch the map/meta-row rendering on it.
       */
      origin: reference('places'),
      /**
       * Where the lot was distilled — the actual palenque. This is the
       * place `lotCode()` reads its STATE segment from, since that's what
       * "GRO·EM·26" denotes (the code names the distillery's state, not
       * necessarily the field's).
       */
      palenque: reference('places'),
      maestro: reference('maestros'),
      /** The hero meta row's 4th chip — a method or manejo highlight; varies per lot. */
      heroTag: localized(),
      /**
       * Section media, keyed by the section it illustrates (01 El Agave,
       * 03 El Maestro, 04 La Ficha's bottle shot). Only 3 of 9 planned
       * photos exist today, so every key is optional and carries no
       * placeholder default — a missing key means "no media column for
       * this section," not "show a grey box." A page template can check
       * `Boolean(lot.data.images?.agave)` etc. to decide between the
       * 2-column sticky-media grid and a full-width prose layout.
       * `maestro` here names the *section* (03 — El Maestro), not
       * necessarily a portrait: today it may be a process shot (e.g. the
       * filipino hollow-trunk still) rather than a picture of the person.
       */
      images: z
        .object({
          agave: image().optional(),
          maestro: image().optional(),
          botella: image().optional(),
        })
        .optional(),
      /**
       * Optional captioned photo strip for section 01 (El Agave) — a small
       * process essay (jima, horno, tahona, still) that doesn't fit the
       * single `images.agave` slot. Ordered as authored; each photo carries
       * its own caption rather than reusing the section prose.
       */
      gallery: z
        .array(
          z.object({
            image: image(),
            caption: localized(),
          }),
        )
        .optional(),
      /**
       * Optional short clip alongside the gallery — video is not run through
       * astro:assets (no built-in transform/optimization for it), so `src`
       * and `poster` are plain root-relative paths into `public/videos/`,
       * pre-compressed (h264 + faststart) before landing there. Same section
       * 01 slot as `gallery`.
       */
      video: z
        .object({
          src: z.string().min(1),
          poster: z.string().min(1),
          caption: localized(),
        })
        .optional(),
      /** Optional tasting-notes spec row, e.g. "Herbales, toque dulce". */
      notes: localized().optional(),
      /** Optional expanded distillation description for the El Maestro spec row. */
      distillationDetail: localized().optional(),
      available: z.boolean().default(true),
      /** Landing-page and next-lot-cycle order. */
      order: z.number().int(),
      /** Explicit "siguiente" target; keeps the cycle a validated join, not an assumption. */
      nextLot: reference('lots').optional(),
    }),
});

const lotProse = defineCollection({
  // id becomes "<slug>/<locale>", e.g. "gro-em-26/es" — matches getLotProse().
  loader: glob({ pattern: '*/{es,en}.mdx', base: './src/content/lots' }),
  schema: z.object({
    section01: z.object({ heading: z.string().min(1), body: z.string().min(1) }),
    section02: z.object({ heading: z.string().min(1), body: z.string().min(1) }),
    section03: z.object({ heading: z.string().min(1), body: z.string().min(1) }),
  }),
});

export const collections = { agaves, places, maestros, lots, lotProse };
