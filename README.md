# Barbechero

Static site for **Barbechero**, a family mezcal project. Each microlot — a
distinct agave, place, maestro mezcalero and year — gets its own page.

> *Barbecho: labrar la tierra y dejarla descansar.*

Built with [Astro](https://astro.build). Ships **zero client-side JavaScript**.
Deploys to GitHub Pages at [barbechero.com](https://barbechero.com).

## Getting started

```bash
npm install
npm run dev      # http://localhost:4321
```

| script | what it does |
|---|---|
| `npm run dev` | dev server with live reload |
| `npm run build` | production build to `dist/` |
| `npm run preview` | serve the built output |
| `npm run verify` | build + typecheck + the full Playwright suite |

## Adding a lot

This is the thing the site is designed for. Content is normalized across four
collections, so a new vintage from a place and maestro already on the site is
one small file — nothing is restated, and a typo in a reference fails the build.

```
src/content/
  lots/<state>-<agave>-<yy>/
    _data.yaml   # structured, locale-independent
    es.mdx       # prose for the three narrative sections
  agaves/        # common + scientific name, manejo
  places/        # locality, region, state, [lon, lat]
  maestros/      # name, distillation method
```

A lot references its agave, its `origin` (where the agave grew), its `palenque`
(where it was distilled — these can differ) and its maestro. Two things are
worth knowing:

- **Colour is one number.** Every lot accent is `oklch(0.52 0.11 H)`; only the
  hue varies. Set `accentHue` and the whole page follows. Never write a hex.
- **The map places itself.** Give a place its `[lon, lat]` and the marker is
  projected at build time — no hand-positioning, and every other lot gains a
  context dot automatically. See `src/lib/projection.ts`.

Photography is optional throughout. A section with no photo renders full-width
prose rather than a placeholder.

## Layout

```
design/     the Claude Design handoff bundle — read-only source of truth
docs/       IMPLEMENTATION-PLAN.md: the spec, every decision and its reasoning
src/
  assets/   photography and the map base
  components/
  content/  the four collections
  layouts/
  lib/      projection, lot helpers, OG card generation
  pages/    / and /lote/[slug]/, plus the OG image endpoint
  styles/   tokens, global, self-hosted fonts
tests/      Playwright: viewport, a11y, metadata
```

`docs/IMPLEMENTATION-PLAN.md` is the reference for anything non-obvious — why
the map is projected rather than hardcoded, why the grey scale is what it is,
what is deliberately missing.

## Verification

`npm run verify` runs 110 assertions across all pages at 360/375/390/768/1280px:
no horizontal overflow, tap targets ≥44px, no text under the 12px mobile floor,
every image decodes, axe-core clean with no tolerated failures, and metadata and
OG cards intact. CI gates deploy on it — nothing publishes if it fails.

## Deployment

Push to `main`. GitHub Actions verifies, builds and publishes to Pages.
`barbechero.com` is an apex domain, so it needs `A`/`AAAA` records at the
registrar — a `CNAME` record will not work at the apex. `public/CNAME` is
already in place.

## Language

Spanish only for now. The i18n routing is configured (`es` at `/`, `en` under
`/en/`), so English is a matter of adding content, not plumbing.
