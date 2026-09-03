import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PAGE_PATHS, VIEWPORT_HEIGHT } from './pages';

/**
 * axe-core over every page, at a phone width and a desktop width — the layout
 * differs enough between them (stacked spec rows, a wrapped footer) that one
 * pass would not cover the other.
 *
 * Plus the things axe cannot see: heading order, landmarks, a skip link that
 * actually moves focus, and a visible focus ring on every control. The design
 * is hover-driven, so keyboard focus is the failure mode most likely to ship
 * unnoticed.
 */
const AXE_WIDTHS = [390, 1280];

/**
 * No contrast shortfall is tolerated. This allowlist is empty.
 *
 * Every one of them is a *design token* — an ink alpha lifted from the source
 * design (plan §1) — used as small text on `--paper`. Fixing them means
 * darkening the brand palette, which is a decision for whoever owns the
 * design, not something a test run should quietly do. They are reported with
 * their measured ratios rather than suppressed as a class: a node is excused
 * only if its foreground is one of these exact colours *and* its measured
 * ratio still matches. Any other contrast failure, a new element in a
 * different grey, or one of these getting worse, fails the run.
 *
 * Measured against --paper #f7f5ee (relative luminance 0.9124):
 *   --faint      .45  #97948d  2.77:1   AA needs 4.5:1
 *   nav idle     .50  #8c8983  3.19:1
 *   --muted      .55  #817e78  3.70:1
 * Passing today, for contrast: --muted-strong .62 (4.59:1), --ink-soft .70
 * (5.92:1), --ink (15.37:1), and all three accents (4.93–5.30:1).
 *
 * Proposed fix, if the palette owner agrees: raise both --faint and --muted
 * to .62 where they carry text. That invents no new colour — .62 is already
 * --muted-strong in the scale — and clears every node below at 4.59:1.
 */
const KNOWN_CONTRAST: Record<string, { token: string; ratio: number }> = {
  // Empty by design. The three shortfalls this once held (--faint .45 at
  // 2.77:1, idle nav .50 at 3.19:1, --muted .55 at 3.70:1) were fixed on
  // 2026-09-03 by raising all three to .62 (4.59:1) — see tokens.css. There
  // is now no allowed contrast failure: any violation fails the run.
};

interface ContrastData {
  fgColor?: string;
  contrastRatio?: number;
}

/** True when this node is one of the documented palette shortfalls above. */
function isKnownPaletteContrast(node: {
  any: { data?: unknown }[];
  all: { data?: unknown }[];
}): boolean {
  const data = (node.any[0]?.data ?? node.all[0]?.data) as ContrastData | undefined;
  if (!data?.fgColor || typeof data.contrastRatio !== 'number') return false;
  const known = KNOWN_CONTRAST[data.fgColor.toLowerCase()];
  return known !== undefined && Math.abs(known.ratio - data.contrastRatio) < 0.05;
}

for (const path of PAGE_PATHS) {
  test.describe(`${path}`, () => {
    for (const width of AXE_WIDTHS) {
      test(`axe finds no violations at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
          .analyze();

        const unexpected = results.violations
          .map((violation) => ({
            ...violation,
            nodes:
              violation.id === 'color-contrast'
                ? violation.nodes.filter((node) => !isKnownPaletteContrast(node))
                : violation.nodes,
          }))
          .filter((violation) => violation.nodes.length > 0);

        const summary = unexpected
          .map(
            (violation) =>
              `${violation.id} (${violation.impact}): ${violation.help}\n` +
              violation.nodes
                .map((node) => `    ${node.target.join(' ')}\n      ${node.failureSummary}`)
                .join('\n'),
          )
          .join('\n');

        expect(unexpected, `axe violations:\n${summary}`).toEqual([]);
      });
    }

    test('headings descend without skipping a level', async ({ page }) => {
      await page.goto(path);
      const levels = await page.$$eval('h1, h2, h3, h4, h5, h6', (nodes) =>
        nodes.map((node) => Number(node.tagName[1])),
      );

      expect(levels[0], 'the first heading on the page is an h1').toBe(1);
      expect(levels.filter((level) => level === 1), 'exactly one h1').toHaveLength(1);

      let previous = levels[0]!;
      for (const level of levels) {
        expect(level - previous, `heading order: h${previous} -> h${level}`).toBeLessThanOrEqual(1);
        previous = level;
      }
    });

    test('landmarks are present and unique', async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('body > header')).toHaveCount(1);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('body > footer')).toHaveCount(1);
      await expect(page.locator('header nav[aria-label]')).toHaveCount(1);
      /* The main landmark is what the skip link targets. */
      await expect(page.locator('main#contenido')).toHaveCount(1);
    });

    test('the skip link is reachable and moves focus to main', async ({ page }) => {
      await page.goto(path);
      await page.keyboard.press('Tab');

      const skip = page.locator('.skip-link');
      await expect(skip).toBeFocused();
      /* Focused, it must be on screen — a skip link that stays at -9999px is
         worse than none, because it silently swallows the first Tab. */
      const box = await skip.boundingBox();
      expect(box, 'the focused skip link has a box').not.toBeNull();
      expect(box!.x, 'the focused skip link is inside the viewport').toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);

      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#contenido$/);
    });

    test('every control has a visible focus indicator', async ({ page }) => {
      await page.goto(path);
      const controls = page.locator('a[href], button, [role="button"]');
      const count = await controls.count();
      expect(count).toBeGreaterThan(0);

      for (let index = 0; index < count; index += 1) {
        const control = controls.nth(index);
        await control.focus();
        const indicator = await control.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            outlineStyle: style.outlineStyle,
            outlineWidth: Number.parseFloat(style.outlineWidth),
            outlineColor: style.outlineColor,
          };
        });
        const label = (await control.textContent())?.trim().slice(0, 30) ?? '';
        expect(
          indicator.outlineStyle !== 'none' && indicator.outlineWidth >= 1,
          `"${label}" has no focus outline (${JSON.stringify(indicator)})`,
        ).toBe(true);
      }
    });
  });
}
