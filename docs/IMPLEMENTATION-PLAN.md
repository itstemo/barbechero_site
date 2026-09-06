# Barbechero — implementation plan

Static site, Astro 7, GitHub Pages. Source design: Claude Design canvas
`Barbechero Sitio.dc.html` (handoff bundle). Bilingual ES/EN, custom domain.

## 1. What the design actually is

A single-page prototype with client-side view switching (`sc-if` + a `DCLogic`
state machine). Four views: `home`, `em`, `cp`, `cy`. In production these become
four real routes — the state machine is a prototype artifact, not a requirement.

Palette and type are uniform across all views:

| Token | Value |
|---|---|
| `--paper` | `#f7f5ee` |
| `--ink` | `#211d17` |
| accent, Espadín—Mexicano | `oklch(0.52 0.11 40)` |
| accent, Cupreata | `oklch(0.52 0.11 250)` |
| accent, Coyote | `oklch(0.52 0.11 115)` |

Every accent is `oklch(0.52 0.11 H)` — same lightness and chroma, hue only.
**A new lot needs exactly one number: its hue.** Store `accentHue` in frontmatter
and derive the colour; never store a hex.

Type: Spectral (300/400 + italic) for display and body, IBM Plex Mono (400/500)
for all caps/label/metadata text. Ink opacities used: `.22 .28 .3 .35 .4 .45 .5
.55 .6 .62 .7`. (Correction: an earlier draft listed `.35`; the real value is
`.035`, the lot-row hover wash.) Collapsed to a named scale in
`src/styles/tokens.css` — `--rule` .22, `--rule-strong` .30, `--rule-heavy` .40,
`--faint` .45, `--muted` .55, `--muted-strong` .62, `--ink-soft` .70,
`--ink-wash` .035 — all derived from `--ink-rgb`, so no hex repeats.

## 2. Page structure (identical across all three lots)

```
hero        eyebrow (dot + MICROLOTE NN — CODE), h1, meta row
01 — EL AGAVE     sticky image | prose + spec rows
02 — EL LUGAR     sticky map   | prose
03 — EL MAESTRO   sticky image | prose + spec rows
04 — LA FICHA     sticky image | spec list + next-lot link
```

One template, no variants. Sections are `grid-template-columns:
repeat(auto-fit,minmax(330px,1fr))`, left column `position:sticky; top:96px`.
Spec rows are a dotted-leader pattern (label / dotted rule / italic value) —
one component, used in three places.

## 3. Content model

Normalized, joined by Astro `reference()`. Structured data is authored once and
is locale-independent; only prose is per-locale.

```
src/content/
  lots/gro-em-26/
    _data.yaml      # code, number, accentHue, year, refs, specs, images
    es.mdx          # prose per section
    en.mdx
  agaves/espadin-mexicano.yaml    # common + scientific name, manejo
  palenques/sierra-norte-gro.yaml # label, coords [lon,lat], state
  maestros/don-roque.yaml         # name, distillation method, portrait
```

Adding a 2027 vintage from a known palenque and maestro is a new `_data.yaml`
plus two prose files. Adding a new region adds one `palenques/*.yaml`.

Lot codes follow `STATE·AGAVE·N` (`GRO·EM·1`, `GRO·CP·2`, `OAX·CY·1`,
`OAX·MX·2`) — derive the display code from parts, don't hand-type it.

**REVISED (user, 2026-09-05):** the last segment was the two-digit harvest
year. It restated what the COSECHA row already shows, and it made the espadín
lot render `GRO·EM·23` under the URL `/lote/gro-em-26/`. It is now `codeNumber`
— the lot's position *within its own state*, so Guerrero and Oaxaca each count
from 1. Authored per lot rather than derived from `order`, because deriving it
would renumber existing codes the day a lot is reordered, and a lot code is the
kind of identifier that ends up printed on a label.

## 3b. Two locations per lot

A lot has a **cultivation site and a distillation site, and they can differ.**
Confirmed by the user for the Espadín—Mexicano lot: the agave is cultivated in
Telixtac, Guerrero and distilled in Pachivia, Guerrero — both in the Sierra
Norte. The prototype hid this by showing one marker per lot.

So the `palenques` collection is generalized to `places` ("palenque" means the
distillery specifically and is the wrong word for a field), and `lots` carries
two required references into it: `origin` and `palenque`. When a lot is grown
and distilled at one site, both point at the same slug — explicit sameness is
better than an optional field whose absence is ambiguous. `lotCode()` continues
to take its STATE segment from the **distillation** place.

Corroborating evidence: the two supplied Espadín photos geotag ~8km apart — the
agave field at 18.344, -99.836 and the hollow-trunk still at 18.399, -99.778.
Consistent with two sites, but not proof; coordinates for Telixtac and Pachivia
are **unconfirmed** and marked TODO in the content files.

**DECIDED (user, 2026-09-02): one marker.** Two markers joined by a hairline was
considered and rejected on measurement, not taste: Telixtac and Pachivia are
8.6km apart, which at the map's scale (all of southern Mexico in 660x280px) is
**3.35px** — against an 11px marker dot. The two would overlap into one blob.
Two markers is not achievable at this scale.

So `02 — EL LUGAR` draws **one marker, at the palenque** (the distillation site,
which is also what the lot code denotes). The origin/palenque distinction is
carried in the prose and in the `ORIGEN` / `PALENQUE` spec rows in section 04,
where there is room to state it properly.

Caption rule: when `origin !== palenque`, caption with `region, state`
("SIERRA NORTE, GUERRERO" — exactly what the design shows). When they are the
same place, caption with the specific locality.

## 3c. Validation caveat for the page layer

Astro 7.2.10 validates `reference()` targets by walking the synced store, but a
dangling reference is reported through `logger.error(...)` — **it does not throw,
and the build still exits 0** — until something actually calls `getEntry` /
`getEntries` on that field. Bad scalars (`accentHue: 999`, out-of-range coords,
a `codeAgave` regex miss) do fail the build outright; a broken join does not,
on its own.

Consequence for task 6: **resolve references eagerly and do not assume they
resolved.** A page that lazily dereferences a missing place will crash at render
rather than at sync. Verified in `node_modules/astro/dist/content/content-layer.js`
(`#validateReferences` / `#findInvalidReferences`).

## 4. The map — static image, positions computed at build time

**The map is static.** No panning, no zooming, no slippy-map library, no tiles,
no JS shipped to the client. The output is exactly what the prototype shows: one
inline SVG of southern Mexico with a highlighted marker and two dimmed sibling
dots. Optional CSS-only touches (a hover tooltip on a dot, a marker that fades
in on scroll) are fine; changing the viewport is not.

"Projection" below refers only to a build-time arithmetic step that decides
where to put a marker in that fixed SVG. It runs during `astro build` and leaves
no runtime behind.

### Why not keep the hardcoded percentages

The prototype hardcodes marker positions as percentages (`left:38.9%;
top:44.9%`). Those are **derived values**, not design decisions. `map-src.html`
shows the provenance: d3 `geoMercator().fitExtent([[24,24],[736,446]], bbox)`
where `bbox` is the LineString `[[-106.5,13.4],[-89.5,23.2]]`, rendered at
760x470 and cropped to `viewBox="60 110 660 280"`.

Reimplementing that projection in ~15 lines and feeding it `[lon, lat]`
reproduces all three published positions exactly:

| lot | lon, lat | computed | in design |
|---|---|---|---|
| espadin-mexicano | -99.55, 18.35 | 38.9% 44.9% | 38.9% 44.9% |
| cupreata | -99.30, 17.95 | 40.4% 51.1% | 40.4% 51.1% |
| coyote | -96.55, 16.30 | 57.5% 76.3% | 57.5% 76.3% |

So: put `coords: [lon, lat]` on each palenque, project at build time, and a new
lot places its own marker plus the dimmed context dots for every sibling lot.
Do **not** carry the percentages into the codebase. Do not ship d3 to the
client — this is a pure function evaluated during the build.

Label offset direction is currently hand-tuned per lot (`translate(-50%,-260%)`
vs `220%`). Keep an optional `labelPlacement: above | below` on the palenque
rather than trying to auto-solve collisions.

## 5. Assets

Source bundle is vendored read-only at `design/`. Verified optimizations are
staged in `design/optimized/`.

- **The three logos are one artwork.** Verified: all 22 `<path d="…">` values
  hash identically across `logo-mark.svg`, `logo-word.svg` and
  `logo-lockup.svg`; only `viewBox` differs, and `logo-lockup.svg` is
  byte-identical to `uploads/barbechero_logo.svg`. Ship **one** ~9KB asset and
  expose three components that differ only by viewBox:

  | component | viewBox |
  |---|---|
  | `<LogoMark/>` | `155 65 300 215` |
  | `<LogoWord/>` | `30 366 545 64` |
  | `<LogoLockup/>` | `0 0 600 529` |

  Currently wrapped in `translate(0,529) scale(0.1,-0.1)` — flatten it. Inline
  the SVG (it is small and used in the header, hero and footer) so it inherits
  `currentColor` instead of being a fixed `#000` raster request.
- **`map-base.svg` is 81% embedded C2PA manifest**, not artwork: 9,440B, of
  which 7,736B is a single `<metadata>` block. Stripping it plus the unused
  `xmlns:c2pa` yields **1,666B — 83% smaller** with both paths and the
  `viewBox="60 110 660 280"` intact. Done; see `design/optimized/map-base.svg`.
  (The manifest is content-provenance metadata from the design tool; it carries
  no rendering information.)
- `image-slot.js` (omelette placeholder widget) and `support.js` (dc-runtime,
  needs React) are **canvas tooling — do not port**. Replace the nine
  `<image-slot>` elements with Astro `<Image>`.

## 5b. Photography

**No placeholders.** Per the user (2026-09-02): sections without a real photo omit
the media column entirely and render full-width prose. Do NOT ship grey
placeholder boxes. Every image field is therefore `.optional()` in the schema,
and the lot template branches on presence. Photos arrive incrementally.

### On disk (3 of 9)

| file | section | note |
|---|---|---|
| `src/assets/lots/gro-em-26/agave-campo.jpg` | 01 EL AGAVE | agaves in field, hillside |
| `src/assets/lots/gro-em-26/tronco-hueco.jpg` | 03 EL MAESTRO | **the hollow-trunk filipino still, not a portrait of Don Roque** |
| `src/assets/lots/oax-cy-26/agave-campo.jpg` | 01 EL AGAVE | cultivated rows, Oaxaca hills at dusk |

Still missing: both remaining Espadín slots, all three Cupreata slots, and two
Coyote slots. No maestro portraits exist for anyone.

The design's slot 03 is captioned "Retrato de Don Roque", but the photo supplied
is the still. That actually suits the section — its prose is precisely about the
tronco hueco and the método filipino — so the field should be named
subject-neutrally (`image`, not `portrait`).

### Processing pipeline

Source HEIC (4032x3024 / 5712x4284) -> `sips` to lossless PNG (bakes EXIF
orientation) -> `sharp`: `.rotate()`, fit inside 2400px, mozjpeg q84.
Result 1800x2400 each, 3.8MB total.

1800px wide is deliberate, not arbitrary: the media column is at most ~588 CSS px
(1240px max-width, two columns, gap), so 1800px covers 3x DPR exactly. Astro
`<Image>` generates the AVIF/WebP derivatives from these.

**All EXIF and XMP is stripped** — verified via `sharp.metadata()` and a raw
APP1 marker scan. This is deliberate: the originals carry GPS to ~10m, and
publishing the precise coordinates of a maestro's palenque or a family's agave
fields is not something to do by accident.

### Coordinate discrepancy — needs a decision

The photos' original GPS does not match the map coordinates in the design:

| lot | photo GPS | design coords | delta |
|---|---|---|---|
| Espadín—Mexicano | 18.344, -99.836 (2023) / 18.399, -99.778 (2024) | 18.35, -99.55 | ~30 km |
| Coyote | 16.371, -96.667 | 16.30, -96.55 | ~14 km |

A photo's location is not necessarily the palenque's, so this may be nothing.
**Recommendation: keep the design's rounded coordinates.** At the map's scale
(the whole of southern Mexico in 660x280px) a 30km error is roughly one marker
radius and invisible, and deliberately approximate coordinates are the right
call for locating real people's homes and workplaces. Precision here has no
upside.

Separately: the user referred to this lot as "Telixtac Espadín", but the design
labels it "SIERRA NORTE, GUERRERO". Confirm the locality name before it goes on
a page.

## 6. Known defects in the prototype to fix, not reproduce

1. **Landing rows overflow on mobile.** `grid-template-columns:26px
   minmax(220px,1.6fr) 1fr auto` needs ~282px before the last two columns get
   any width; at 375px only ~45px remains. Stack to two rows under ~640px.
2. **Nav does not scale.** Every lot is a hardcoded top-level nav item. At 3 it
   fits; at 8 it wraps badly. Move to `INICIO / LOTES` with the lot list on the
   landing page, or a disclosure.
3. `text-wrap:pretty` is on the Espadín `h1` only — apply consistently.
4. Buttons used for navigation. Use `<a href>` so links are real.
5. **All prose is Spanish; no English exists.** Bilingual requires translation
   that is not in the bundle. See open questions.
6. No `alt` text on the logo mark (correct, decorative) but the map `alt` is
   generic — give it the lot's locality.

## 6b. Mobile — treated as a first-class target, not a fallback

The prototype was composed at desktop width. It is not mobile-ready, and several
of its problems are measured below rather than assumed. Target: excellent at
375px (iPhone SE/mini), 390–430px (modern iPhone), 360px (common Android), and
768px, as well as desktop. Breakpoints: `640px`, `900px`, `1240px` (the existing
`max-width`).

### Layout defects that produce horizontal scroll or overflow

1. **`minmax(330px,1fr)` overflows every content section.** Used 12 times. A
   `minmax` minimum is a hard floor: at a 375px viewport the content box is
   327px, so the single grid track is still forced to 330px and the page scrolls
   sideways. At 360px it overflows by 18px. Fix globally with the standard
   idiom: `minmax(min(330px,100%),1fr)`. Same fix for the three
   `minmax(220px,...)` on the landing rows.
2. **Landing lot rows.** `26px + minmax(220px,1.6fr) + 1fr + auto` with three
   gaps consumes ~282px before columns 3 and 4 get any width; 327px leaves ~45px
   for the locality, the maestro and the lot code. Restructure under 640px to a
   two-row stack: index + name on the first row, locality/maestro and lot code
   on the second.
3. **`min-height:calc(100vh - 190px)` on the landing hero.** `100vh` on iOS
   Safari is the tall viewport, so the hero exceeds the visible area and the
   layout shifts as the URL bar collapses. Use `100svh`, and derive the
   subtrahend from a `--header-h` custom property instead of the hardcoded
   190px, which assumes desktop header and footer heights.
4. **Sticky offsets assume a desktop header.** Sections use `top:96px`, but the
   mobile header wraps to two rows (logo ~170px + nav ~438px of content at
   375px) and stands ~100px tall. Set `--header-h` per breakpoint and use
   `top:calc(var(--header-h) + 1rem)`.
5. **Sticky media columns are pointless once stacked.** In a single-column grid
   each image is its own row, so `position:sticky` has no travel. Disable it
   below 900px rather than leaving dead positioning in place.

### Touch, legibility and input

6. **Nav touch targets are ~12px tall.** 9.5px type with zero padding, far below
   the 44×44px minimum. Every nav item, lot row and next-lot link needs a real
   target — pad the control, don't just enlarge text.
7. **Type is too small on mobile.** Mono runs at 8.5px (×4), 9px (×29) and
   9.5px (×29). The 8.5px footer legal text in particular is not reasonably
   readable on a phone. Introduce a mono scale with a mobile floor around
   11px, letting the desktop values stand at their current sizes.
8. **Hover-only affordances.** All interaction is expressed through
   `style-hover`, which never fires on touch. Add `:focus-visible` and `:active`
   states, and guard hover styling with `@media (hover:hover)`.
9. **`h1` at the 46px clamp floor wraps mid-phrase** ("Espadín — Mexicano" needs
   roughly 370px at 46px against 327px available). Wrapping is fine for a
   display face; add `text-wrap:balance` so it breaks evenly.
10. **The dotted-leader spec rows collapse.** ORIGEN / "San Miguel de las
    Palmas, Guerrero" needs ~315px of the 327px available, leaving the dotted
    leader ~12px — the pattern stops reading as a leader. Below ~480px, stack
    label above value and drop the leader. *This changes the look on mobile and
    is worth a visual sign-off.*
11. **Footer right-alignment.** `text-align:right` on the legal block reads as
    misalignment once the flex row wraps. Left-align below 640px.

### Performance on mobile networks

12. **Self-host and subset the fonts.** The bundle requests 8 faces from Google
    Fonts; only 5 are used — Spectral 400, italic 300, italic 400 and Plex Mono
    400, 500 (Spectral 500, 600 and the 300 upright are never referenced).
    Self-host those 5 as woff2 subset to Latin + Spanish diacritics, `preload`
    the two used above the fold, `font-display:swap`. This removes two
    render-blocking third-party connections on the critical path.
13. **Images.** Nine slots per the design, each `clamp(300px,44vw,540px)` tall —
    which means a 300px-tall image above every text block on mobile. Serve AVIF
    and WebP via Astro `<Image>` with width-appropriate `srcset`, explicit
    dimensions to reserve space (no CLS), and `loading="lazy"` on everything
    below the hero. Consider a shorter mobile aspect ratio so the reader is not
    scrolling past 300px of photo before each section.
14. **`backdrop-filter:blur(6px)`** on the sticky header is costly on low-end
    Android; the background is already 92% opaque, so guard it with
    `@supports` and let the solid colour serve as the fallback.
15. **`scroll-behavior:smooth`** is set unconditionally. Wrap it in
    `@media (prefers-reduced-motion:no-preference)`.

### Verification

Mobile correctness is asserted, not eyeballed: a Playwright pass at 360/375/390/
768/1280 that fails on any horizontal overflow (`scrollWidth > clientWidth`), on
any tap target under 44px, and on computed font sizes below the mobile floor.
Lighthouse mobile budget: performance ≥ 95, accessibility 100.

**2026-09-05 update.** The Playwright pass is the CI gate (deploy.yml), not
the local edit loop. Locally a change is verified with build + `astro check`
+ a look at the affected pages in the browser, including the widths between
the listed breakpoints; the three layout bugs that shipped were found that
way and none was caught by the suite. The suite was collapsed to one page
load per page per width (360/768/1280) on the same date. Policy lives in
CLAUDE.md.

## 7. Routes

```
/                       ES landing        /en/                    EN landing
/lote/[slug]/           ES lot page       /en/lot/[slug]/         EN lot page
```

`site: https://barbechero.com`, no `base` (custom domain), `public/CNAME`.
Deploy with `withastro/action@v6` (action version; unrelated to the Astro major),
CI pinned to Node 22. **Stack is Astro 7.2.10** — an earlier draft of this plan
said Astro 6, which was wrong.

## 8. Task breakdown

| # | Task | Model | Depends on |
|---|---|---|---|
| 1 | ~~Scaffold, astro.config, i18n routing, CI, CNAME~~ **DONE** — Astro 7.2.10, mdx 8, sitemap 3.7; build + `astro check` clean | Sonnet | — |
| 2 | ~~Tokens + primitives~~ **DONE** — colour/type scale **with mobile floors**, responsive SpecRow, SectionHeading, logo components, SVG optimization, self-hosted subset fonts | Opus | — |
| 3 | Content collections + Zod schemas | Sonnet | — | *(in revision: two-location model)* |
| 4 | Map component: static SVG, build-time projection from coords | Opus | 3 |
| 5 | Landing page incl. the mobile lot-row restructure and `svh` hero | Opus | 1,2,3 |
| 6 | Lot page template, accent theming, responsive section grid | Opus | 2,3,4 |
| 7 | Author the 3 lots from the design's Spanish copy | Sonnet | 3 |
| 8 | Responsive header/nav that survives N lots + touch targets | Opus | 5,6 |
| 9 | Playwright viewport assertions + a11y / SEO / OG / Lighthouse | Sonnet | all |

1, 2, 3 have no interdependencies and run in parallel first.

Every task that renders UI owns its own mobile behaviour — mobile is not
deferred to task 9. Task 9 verifies; it does not retrofit.

## 8b. Palette and type-floor decisions (user, 2026-09-03)

**Contrast: `--faint` and `--muted` raised to .62**, along with the idle-nav and
hero-tagline `.50`. Verified: .45 measured 2.78:1, .50 3.20:1, .55 3.71:1 against
`#f7f5ee` — all below the 4.5:1 AA floor for small text. The minimum alpha that
reaches 4.5:1 is **0.613**, so .62 (4.59:1) is the lowest step in the existing
scale that passes; no new colour was invented. Cost, accepted knowingly: the
three-step grey hierarchy for text collapses to one. There is no arrangement of
three distinct receding greys on this paper that passes AA. All three accents
already passed (4.93-5.30:1) and were untouched.

**Mono floor raised 11px -> 12px** to clear Lighthouse's legible-font-size audit.
Floors step 12 / 12 / 12.5 / 13 rather than a flat 12, so the mobile size
hierarchy survives. Desktop values at 1240px are unchanged from the design.
The Playwright suite asserts the 12px floor; the axe allowlist is now empty, so
any contrast regression fails the run.

Result: Lighthouse mobile **99 performance / 100 accessibility / 100 best
practices / 100 SEO** on the landing page and lot pages.

## 9. Open questions

- ~~Domain name~~ — **barbechero.com** (apex). Confirmed 2026-09-02.
- **English copy** — translate the Spanish, or ship ES-only first and add EN later?
- **Photography** — nine image slots are empty. Placeholders for now?
- **Age gate** — alcohol brand site; the design has none. The Mexican health
  warning is already in the footer.
