import { expect, test } from '@playwright/test';
import {
  MIN_FONT_SIZE,
  MIN_TAP,
  MOBILE_WIDTHS,
  PAGE_PATHS,
  VIEWPORTS,
  VIEWPORT_HEIGHT,
} from './pages';

/**
 * The measured half of plan §6b: horizontal overflow, touch targets, the
 * mobile type floor, and whether the images actually decoded — on every page,
 * at every listed width.
 *
 * These are assertions, not a report. Each one fails the run and names the
 * offending elements, because the defects they guard against (a grid track
 * with a hard 330px floor, a 12px nav hit area, 8.5px legal text) are exactly
 * the ones that look fine in a screenshot.
 */

/** Walk the page so `loading="lazy"` images are actually requested. */
async function loadEverything(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle');
}

for (const path of PAGE_PATHS) {
  test.describe(`${path}`, () => {
    for (const width of VIEWPORTS) {
      test(`no horizontal overflow at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await page.goto(path);
        await loadEverything(page);

        /*
         * `body { overflow-x: hidden }` is in the stylesheet, and it does not
         * fix overflow — it hides it, and takes `documentElement.scrollWidth`
         * with it. Forcing the property back to `visible` is what makes this
         * assertion able to see a genuine overflow at all.
         */
        await page.addStyleTag({
          content: 'html, body { overflow-x: visible !important; }',
        });

        const report = await page.evaluate(() => {
          const root = document.documentElement;
          const limit = root.clientWidth;
          const offenders: { tag: string; id: string; right: number }[] = [];

          for (const element of document.querySelectorAll<Element>('body *')) {
            /*
             * Skip the children of an <svg>: getBoundingClientRect reports a
             * path's untransformed user-space box and ignores the viewBox
             * crop, so an inline logo whose artwork is deliberately larger
             * than its viewport reads as a 600px-wide overflow that does not
             * exist. The <svg> element itself is still measured.
             */
            if (element instanceof SVGElement && element.tagName.toLowerCase() !== 'svg') {
              continue;
            }
            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden') continue;

            const rect = element.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            if (rect.right > limit + 1) {
              const id = [
                element.id ? `#${element.id}` : '',
                element.className && typeof element.className === 'string'
                  ? `.${element.className.trim().split(/\s+/).join('.')}`
                  : '',
              ].join('');
              offenders.push({
                tag: element.tagName.toLowerCase(),
                id,
                right: Math.round(rect.right),
              });
            }
          }

          return { scrollWidth: root.scrollWidth, clientWidth: limit, offenders };
        });

        expect(
          report.offenders,
          `Elements extending past ${report.clientWidth}px:\n` +
            report.offenders
              .map((o) => `  ${o.tag}${o.id} -> right edge ${o.right}px`)
              .join('\n'),
        ).toEqual([]);
        expect(report.scrollWidth, 'documentElement.scrollWidth').toBe(report.clientWidth);
      });

      test(`tap targets are at least ${MIN_TAP}px at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await page.goto(path);
        await loadEverything(page);

        const small = await page.evaluate((minimum) => {
          const selector = 'a[href], button, [role="button"], input, select, summary, textarea';
          const failures: { label: string; width: number; height: number }[] = [];

          for (const element of document.querySelectorAll<HTMLElement>(selector)) {
            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden') continue;

            /* An inline control that wraps has one box per line; the target is
               the largest of them, not their bounding union. */
            const rects = [...element.getClientRects()];
            const box = rects.length
              ? rects.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b))
              : element.getBoundingClientRect();

            if (box.width + 0.5 < minimum || box.height + 0.5 < minimum) {
              const label =
                (element.textContent ?? '').trim().slice(0, 40) ||
                element.getAttribute('aria-label') ||
                element.tagName.toLowerCase();
              failures.push({
                label,
                width: Math.round(box.width * 10) / 10,
                height: Math.round(box.height * 10) / 10,
              });
            }
          }
          return failures;
        }, MIN_TAP);

        expect(
          small,
          `Controls under ${MIN_TAP}x${MIN_TAP}:\n` +
            small.map((f) => `  "${f.label}" -> ${f.width}x${f.height}`).join('\n'),
        ).toEqual([]);
      });

      test(`every image decodes at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await page.goto(path);
        await loadEverything(page);

        /*
         * Decode state, not pixels: AVIF is chosen first by srcset and does
         * not necessarily paint by the time a screenshot is taken, so a
         * visual check reports false failures. `complete && naturalWidth > 0`
         * is the browser saying it has real image data.
         */
        const broken = await page.evaluate(() =>
          [...document.querySelectorAll('img')]
            .filter((img) => !img.complete || img.naturalWidth === 0)
            .map((img) => ({ src: img.currentSrc || img.src, alt: img.alt })),
        );

        expect(
          broken,
          `Images that did not load:\n` +
            broken.map((b) => `  ${b.src} (alt: ${b.alt})`).join('\n'),
        ).toEqual([]);
      });
    }

    for (const width of MOBILE_WIDTHS) {
      test(`no text under ${MIN_FONT_SIZE}px at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await page.goto(path);
        await loadEverything(page);

        const tooSmall = await page.evaluate((floor) => {
          const failures: { tag: string; size: number; text: string }[] = [];

          for (const element of document.querySelectorAll<HTMLElement>('body *')) {
            /* Only elements that actually render text of their own — an outer
               wrapper inherits a size it never paints with. */
            const ownText = [...element.childNodes]
              .filter((node) => node.nodeType === Node.TEXT_NODE)
              .map((node) => node.textContent ?? '')
              .join('')
              .trim();
            if (!ownText) continue;

            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            /* Visually-hidden text is for assistive tech; it has no legibility
               requirement because it is never read on screen. */
            if (element.closest('.u-visually-hidden')) continue;

            const size = Number.parseFloat(style.fontSize);
            if (size + 0.01 < floor) {
              failures.push({
                tag: element.tagName.toLowerCase(),
                size: Math.round(size * 100) / 100,
                text: ownText.slice(0, 40),
              });
            }
          }
          return failures;
        }, MIN_FONT_SIZE);

        expect(
          tooSmall,
          `Text rendered below the ${MIN_FONT_SIZE}px mobile floor:\n` +
            tooSmall.map((f) => `  <${f.tag}> ${f.size}px — "${f.text}"`).join('\n'),
        ).toEqual([]);
      });
    }

    for (const width of VIEWPORTS) {
      /*
       * The map's pin caption is absolutely positioned against the marker, so
       * nothing in the layout stops it leaving the frame: a low marker plus a
       * caption long enough to wrap put "PALO GRANDE · LA CHAGA, MIAHUATLÁN,
       * OAXACA" straight through the Natural Earth credit line on both Oaxaca
       * lots, at every width up to 768px. Vertical collisions are invisible to
       * the overflow test above — it only ever looked sideways.
       */
      test(`the map caption stays inside its frame at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await page.goto(path);

        const escapes = await page.evaluate(() => {
          const failures: { edge: string; by: number; text: string }[] = [];

          for (const label of document.querySelectorAll<HTMLElement>('[class*="lot-map__label"]')) {
            const frame = label.parentElement;
            if (!frame) continue;
            const l = label.getBoundingClientRect();
            const f = frame.getBoundingClientRect();
            const text = (label.textContent ?? '').trim();
            const over = (edge: string, by: number) => {
              if (by > 0.5) failures.push({ edge, by: Math.round(by * 10) / 10, text });
            };
            over('top', f.top - l.top);
            over('bottom', l.bottom - f.bottom);
            over('left', f.left - l.left);
            over('right', l.right - f.right);
          }
          return failures;
        });

        expect(
          escapes,
          `Map captions rendered outside the map:\n` +
            escapes.map((e) => `  ${e.by}px past the ${e.edge} — "${e.text}"`).join('\n'),
        ).toEqual([]);
      });
    }
  });
}
