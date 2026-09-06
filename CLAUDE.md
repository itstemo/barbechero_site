# Barbechero

Astro 7 static site for a bilingual mezcal brand (ES/EN). Content lives in four
normalized collections under `src/content/` (`lots/`, `agaves/`, `places/`,
`maestros/`); a lot references the other three so nothing is restated. Routing
is bilingual: `/` and `/lote/[slug]/` are Spanish, `/en/` and `/en/lot/[slug]/`
are English. `README.md` explains how to add a lot. `docs/IMPLEMENTATION-PLAN.md`
is the spec: every non-obvious decision and its reasoning lives there.

## Verifying a change

The default verification for any change is `npm run build && npx astro check`
(about 10 seconds), then look at the affected pages in the browser preview
(dev server config is `.claude/launch.json`, name `barbechero`) and take
screenshots at 390px and 1280px wide. For a multi-step change, verify once at
the end, not after each step.

Do not run the Playwright suite (`npm test` / `npm run verify`) as routine
verification. It is the CI gate in `.github/workflows/deploy.yml` and runs
there on every push to main. Run it locally only when the change touches the
document head or metadata (`src/layouts`), i18n routing (`src/i18n`), or the
shared header/nav/footer, and then at most once, at the end, with
`npx playwright test --reporter=dot` to keep the output small. If only one
area changed, run just that spec file, e.g. `npx playwright test
tests/meta.spec.ts`.

When touching `src/components/LotPage.astro`, `src/components/LotGallery.astro`
or `src/components/LotMedia.astro` CSS, also screenshot at 600, 800 and
1000px. The section grid collapses from two columns to one around 745px, and
the bugs that have shipped lived between the standard breakpoints. No fixed
set of test widths catches that; only looking does.

Do not add new Playwright tests for layout appearance. The suite asserts
invariants (overflow, tap targets, type floor, axe, metadata, i18n pairing),
not how things look. A layout-appearance test was once added and deleted
within the same PR for exactly this reason.

Prefer editing the site over editing the tests to make a feature pass. If a
test genuinely encodes an old rule (for example the old "zero scripts" rule
that dark mode relaxed to "no fetched scripts"), update the rule and say why
in the test comment.

## Conventions

- A lot's accent colour is a single `accentHue` number, never a hex value.
- Places carry `[lon, lat]`; the map projects them at build time.
- Photography is optional. A section with no photo renders full-width prose
  instead of a placeholder.
