/**
 * Every UI string on the site, both languages side by side.
 *
 * HOW TO ADD A STRING — one line, one file, both languages:
 *
 *   1. Put it in the group it belongs to below (nav, section, spec, ...):
 *        myThing: { es: 'MI COSA', en: 'MY THING' },
 *      A parameterised string is a pair of functions in the same shape:
 *        myCount: { es: (n: number) => `COSA ${n}`, en: (n: number) => `THING ${n}` },
 *   2. Use it: `t(ui.group.myThing, locale)` — or `t(ui.group.myCount, locale, 3)`.
 *
 * Leaving out `en` (or `es`) is a **compile error**, not a silent fallback:
 * the `satisfies` clause at the bottom requires every entry to be complete in
 * every locale, so `astro check` fails rather than the page rendering
 * Spanish to an English reader. That is the whole point of this shape.
 *
 * `{ es, en }` is also exactly the shape the *content* fields use
 * (`manejoLabel`, `heroTag`, `notes`, `distillationDetail`,
 * `distillationMethod` in src/content.config.ts), and `t()` reads both — so
 * there is one mental model for localized text, not two.
 *
 * Translation policy (see the task brief and docs/IMPLEMENTATION-PLAN.md):
 * terms of art stay in Spanish — *palenque*, *maestro mezcalero*, *método
 * filipino*, *tronco hueco*, *alambique de refrescadera*, *barbecho* — and
 * are glossed in the English prose on first use. What is genuinely
 * descriptive is translated.
 */
import type { Locale } from './routes';

/** A value that exists in every locale. Strings and formatters alike. */
export type Localized<T = string> = Record<Locale, T>;

/** Loosest formatter signature; only used as a `satisfies` bound. */
type Formatter = (...args: never[]) => string;

type Entry = Localized<string> | Localized<Formatter>;

/* --------------------------------------------------------------------------
   The dictionary. Grouped by area for navigability; both locales are always
   adjacent, so a group is never a second place you have to remember to edit.
   -------------------------------------------------------------------------- */

export const ui = {
  /** Header, skip link, language toggle. */
  nav: {
    skipToContent: { es: 'SALTAR AL CONTENIDO', en: 'SKIP TO CONTENT' },
    home: { es: 'INICIO', en: 'HOME' },
    lots: { es: 'LOTES', en: 'LOTS' },
    ariaMain: { es: 'Principal', en: 'Main' },
    ariaBrand: { es: 'Barbechero — inicio', en: 'Barbechero — home' },
    ariaLanguage: { es: 'Idioma', en: 'Language' },
    /* The toggle's two faces. Labelled in their own language, as language
       pickers are, so they read the same on either page. */
    langEs: { es: 'ES', en: 'ES' },
    langEn: { es: 'EN', en: 'EN' },
    ariaLangEs: { es: 'Español', en: 'Español' },
    ariaLangEn: { es: 'English', en: 'English' },
    /* The theme toggle. One button, and its label names the state it will
       move you *to* — that is what a reader who cannot see the icon needs to
       know before pressing it. `ariaTheme` labels the button before the
       script has resolved which way it points; the two below replace it. */
    ariaTheme: { es: 'Tema', en: 'Theme' },
    themeToDark: { es: 'Cambiar a modo oscuro', en: 'Switch to dark mode' },
    themeToLight: { es: 'Cambiar a modo claro', en: 'Switch to light mode' },
  },

  /** The four section eyebrows on a lot page. */
  section: {
    agave: { es: 'EL AGAVE', en: 'THE AGAVE' },
    place: { es: 'EL LUGAR', en: 'THE PLACE' },
    /* "Maestro" (mezcalero) is the term of art and is kept. */
    maestro: { es: 'EL MAESTRO', en: 'THE MAESTRO' },
    /* "La ficha" is the spec sheet — agave, origin, palenque, maestro,
       distillation, harvest, lot code. Translated rather than kept: it is
       descriptive, not a term of art. */
    ficha: { es: 'LA FICHA', en: 'THE SPEC SHEET' },
  },

  /** Dotted-leader spec-row labels. */
  spec: {
    species: { es: 'ESPECIE', en: 'SPECIES' },
    /* The design shows the plural for the hybrid lot. English does not
       inflect here, so both forms are the same word — kept as its own key
       so the call site stays a straight lookup rather than a language test. */
    speciesPlural: { es: 'ESPECIES', en: 'SPECIES' },
    /* "Manejo" covers wild / cultivated / hybrid — how the agave was come
       by. English-language labels conventionally say "Cultivation", wild
       included. */
    manejo: { es: 'MANEJO', en: 'CULTIVATION' },
    notes: { es: 'NOTAS', en: 'NOTES' },
    agave: { es: 'AGAVE', en: 'AGAVE' },
    origin: { es: 'ORIGEN', en: 'ORIGIN' },
    /* Term of art: the distillery. Kept in Spanish in both locales. */
    palenque: { es: 'PALENQUE', en: 'PALENQUE' },
    maestro: { es: 'MAESTRO', en: 'MAESTRO' },
    distillation: { es: 'DESTILACIÓN', en: 'DISTILLATION' },
    harvest: { es: 'COSECHA', en: 'HARVEST' },
    lot: { es: 'LOTE', en: 'LOT' },
  },

  /** Lot-page chrome. */
  lot: {
    microlot: {
      es: (n: number) => `MICROLOTE ${String(n).padStart(2, '0')}`,
      en: (n: number) => `MICROLOT ${String(n).padStart(2, '0')}`,
    },
    harvestYear: {
      es: (year: number) => `COSECHA ${year}`,
      en: (year: number) => `HARVEST ${year}`,
    },
    next: {
      es: (name: string) => `SIGUIENTE — ${name} →`,
      en: (name: string) => `NEXT — ${name} →`,
    },
  },

  /** Landing page. */
  home: {
    /* User instruction: "destilado de agave" becomes "agave spirit". */
    lede: { es: 'Mezcal & Destilado de agave', en: 'Mezcal & Agave Spirit' },
    tagline: {
      es: 'BARBECHO — LABRAR LA TIERRA Y DEJARLA DESCANSAR',
      en: 'BARBECHO — TO TILL THE EARTH AND LET IT REST',
    },
    lotsTitle: { es: 'LOTES', en: 'LOTS' },
    harvest: {
      es: (range: string) => `COSECHA ${range}`,
      en: (range: string) => `HARVEST ${range}`,
    },
  },

  /** Footer. */
  footer: {
    /* "Barbecho" is the brand's own root word and survives translation; the
       English carries the meaning after it. */
    tagline: {
      es: 'Barbecho: labrar la tierra y dejarla descansar.',
      en: 'Barbecho: to till the earth and let it rest.',
    },
    about: { es: 'NOSOTROS', en: 'ABOUT' },
    /* The visible text is the handle itself — the same in both locales, so
       only the accessible name is translated. */
    instagramAria: { es: 'Barbechero en Instagram', en: 'Barbechero on Instagram' },
    /* Translated for the English page because this is a website, not a
       bottle label — comprehension wins over the regulated Spanish wording.
       Flagged for the user: a label would have to keep the NOM text verbatim. */
    origin: {
      es: 'MEZCAL ARTESANAL — HECHO EN MÉXICO',
      en: 'ARTISANAL MEZCAL — MADE IN MEXICO',
    },
    warning: {
      es: 'EL ABUSO EN EL CONSUMO DE ESTE PRODUCTO ES NOCIVO PARA LA SALUD',
      en: 'EXCESSIVE CONSUMPTION OF THIS PRODUCT IS HARMFUL TO HEALTH',
    },
  },

  /** The `02 — EL LUGAR` map. */
  map: {
    credit: {
      es: 'GEOMETRÍA: NATURAL EARTH · PROYECCIÓN MERCATOR',
      en: 'GEOMETRY: NATURAL EARTH · MERCATOR PROJECTION',
    },
    alt: {
      es: (place: string) => `Mapa del sur de México: ${place}.`,
      en: (place: string) => `Map of southern Mexico: ${place}.`,
    },
    altAmongSiblings: {
      es: (place: string) =>
        `Mapa del sur de México: ${place}, señalado entre los demás microlotes.`,
      en: (place: string) =>
        `Map of southern Mexico: ${place}, marked among the other microlots.`,
    },
  },

  /** Photography alt text. */
  media: {
    agave: {
      es: (code: string) => `Agave del microlote ${code} en campo.`,
      en: (code: string) => `Agave from microlot ${code} in the field.`,
    },
    maestro: {
      es: (code: string) => `El proceso de destilación del microlote ${code}.`,
      en: (code: string) => `The distillation process of microlot ${code}.`,
    },
    botella: {
      es: (code: string) => `Botella del microlote ${code}.`,
      en: (code: string) => `Bottle of microlot ${code}.`,
    },
  },

  /** `<title>`, meta descriptions, OG card alt text, JSON-LD. */
  meta: {
    homeTitle: {
      es: 'Barbechero — Mezcal & Destilado de agave',
      en: 'Barbechero — Mezcal & Agave Spirit',
    },
    homeDescription: {
      es: 'Barbechero: microlotes de mezcal artesanal de México. Barbecho: labrar la tierra y dejarla descansar.',
      en: 'Barbechero: microlots of artisanal mezcal from Mexico. Barbecho: to till the earth and let it rest.',
    },
    homeOgAlt: {
      es: 'Barbechero — Mezcal & Destilado de agave',
      en: 'Barbechero — Mezcal & Agave Spirit',
    },
    /* The English title says "Lot" where the Spanish says nothing: the two
       otherwise differ only in punctuation, since the agave name and the lot
       code are language-independent, and two pages with byte-identical
       <title> is a real SEO defect (and a failing assertion). */
    lotTitle: {
      es: (name: string, code: string) => `${name} — ${code} · Barbechero`,
      en: (name: string, code: string) => `${name} — Lot ${code} · Barbechero`,
    },
    lotDescription: {
      es: (microlot: string, code: string, name: string, place: string, maestro: string, year: number) =>
        `${microlot} ${code}: ${name}, ${place}, ${maestro}. Cosecha ${year}.`,
      en: (microlot: string, code: string, name: string, place: string, maestro: string, year: number) =>
        `${microlot} ${code}: ${name}, ${place}, ${maestro}. Harvest ${year}.`,
    },
    lotOgAlt: {
      es: (microlot: string, code: string, name: string) =>
        `Barbechero — ${microlot} ${code}, ${name}`,
      en: (microlot: string, code: string, name: string) =>
        `Barbechero — ${microlot} ${code}, ${name}`,
    },
    /* The on-page heading comes from the about entry's own `title` field
       (src/content/about/{es,en}.mdx) — these are only the <title>/meta
       strings, which stay in the dictionary like every other page's. */
    aboutTitle: { es: 'Nosotros · Barbechero', en: 'About · Barbechero' },
    aboutDescription: {
      es: 'Quiénes somos: la familia y el proyecto detrás de Barbechero.',
      en: 'Who we are: the family and the project behind Barbechero.',
    },
    aboutOgAlt: { es: 'Barbechero — Nosotros', en: 'Barbechero — About' },
  },

} as const satisfies Record<string, Record<string, Entry>>;

/* --------------------------------------------------------------------------
   Lookup
   -------------------------------------------------------------------------- */

/**
 * Read a localized value: `t(ui.nav.home, locale)`, or
 * `t(ui.lot.microlot, locale, 1)` for a parameterised one.
 *
 * The same call also reads localized *content* fields — `t(agave.manejoLabel,
 * locale)` — because they are the same `{ es, en }` shape.
 */
export function t(entry: Localized<string>, locale: Locale): string;
export function t<A extends unknown[]>(
  entry: Localized<(...args: A) => string>,
  locale: Locale,
  ...args: A
): string;
export function t(entry: Localized<unknown>, locale: Locale, ...args: unknown[]): string {
  const value = entry[locale];
  return typeof value === 'function'
    ? (value as (...a: unknown[]) => string)(...args)
    : (value as string);
}
