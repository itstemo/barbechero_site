# Design handoff (read-only)

Vendored export from the Claude Design canvas project
"Barbechero Mezcal Label System". **Do not edit these files** — they are the
source of truth for visual fidelity. Implementation lives in `src/`.

- `Barbechero Sitio.dc.html` — the site design. Primary reference.
- `Barbechero Label Proposals*.dc.html` — bottle label designs (not the site).
- `map-src.html` — the d3 script that generated `assets/map-base.svg`.
  Documents the projection; see docs/IMPLEMENTATION-PLAN.md §4.
- `assets/` — logos and the map base. Note all three logo SVGs are the same
  artwork at different viewBox crops.
- `optimized/` — cleaned assets ready to use (map-base.svg, C2PA stripped,
  9,440B -> 1,666B).
- `image-slot.js`, `support.js` — Claude Design canvas runtime. NOT for
  production; kept only so the .dc.html files remain readable in context.
- `uploads/` — git-ignored. Orphaned screenshots, referenced by nothing.
