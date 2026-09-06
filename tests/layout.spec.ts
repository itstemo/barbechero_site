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
 * The measured half of plan §6b: touch targets, whether the images actually
 * decoded, the mobile type floor, and horizontal overflow — on every page, at
 * every listed width.
 *
 * All four are one test per page per width, because they share the expensive
 * part: a page load and a scroll walk to trigger the lazy images. Each
 * category is a soft assertion, so one run reports every category that fails
 * on that page and width rather than stopping at the first.
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
      test(`layout invariants at ${width}px`, async ({ page }) => {
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

        expect.soft(
          small,
          `Controls under ${MIN_TAP}x${MIN_TAP}:\n` +
            small.map((f) => `  "${f.label}" -> ${f.width}x${f.height}`).join('\n'),
        ).toEqual([]);

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

        expect.soft(
          broken,
          `Images that did not load:\n` +
            broken.map((b) => `  ${b.src} (alt: ${b.alt})`).join('\n'),
        ).toEqual([]);

        if (MOBILE_WIDTHS.includes(width)) {
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

          expect.soft(
            tooSmall,
            `Text rendered below the ${MIN_FONT_SIZE}px mobile floor:\n` +
              tooSmall.map((f) => `  <${f.tag}> ${f.size}px — "${f.text}"`).join('\n'),
          ).toEqual([]);
        }

        /*
         * Overflow goes last, because it is the only check that mutates the
         * page: `body { overflow-x: hidden }` is in the stylesheet, and it does
         * not fix overflow — it hides it, and takes `documentElement.scrollWidth`
         * with it. Forcing the property back to `visible` is what makes this
         * assertion able to see a genuine overflow at all, and doing it after
         * the others means it cannot perturb them.
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

        expect.soft(
          report.offenders,
          `Elements extending past ${report.clientWidth}px:\n` +
            report.offenders
              .map((o) => `  ${o.tag}${o.id} -> right edge ${o.right}px`)
              .join('\n'),
        ).toEqual([]);
        expect.soft(report.scrollWidth, 'documentElement.scrollWidth').toBe(report.clientWidth);
      });
    }
  });
}
