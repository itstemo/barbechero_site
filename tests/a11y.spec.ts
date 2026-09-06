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

/*
 * No contrast failure is tolerated. The palette shortfalls this file once
 * allowlisted (--faint .45, idle nav .50, --muted .55) were fixed on
 * 2026-09-03 by raising all three greys to .62, i.e. 4.59:1 (plan §8b), so
 * any color-contrast violation now fails the run like any other.
 */

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

        const unexpected = results.violations;

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

    /*
     * One load for the four checks axe cannot make. Order matters: the skip
     * link presses Enter and puts #contenido on the URL, so the heading and
     * landmark reads happen before it. Focusing controls afterwards is
     * unaffected by the hash.
     */
    test('structure and keyboard: headings, landmarks, skip link, focus rings', async ({
      page,
    }) => {
      await page.goto(path);

      const levels = await page.$$eval('h1, h2, h3, h4, h5, h6', (nodes) =>
        nodes.map((node) => Number(node.tagName[1])),
      );

      expect.soft(levels[0], 'the first heading on the page is an h1').toBe(1);
      expect.soft(levels.filter((level) => level === 1), 'exactly one h1').toHaveLength(1);

      let previous = levels[0]!;
      for (const level of levels) {
        expect
          .soft(level - previous, `heading order: h${previous} -> h${level}`)
          .toBeLessThanOrEqual(1);
        previous = level;
      }

      await expect.soft(page.locator('body > header')).toHaveCount(1);
      await expect.soft(page.locator('main')).toHaveCount(1);
      await expect.soft(page.locator('body > footer')).toHaveCount(1);
      await expect.soft(page.locator('header nav[aria-label]')).toHaveCount(1);
      /* The main landmark is what the skip link targets. */
      await expect.soft(page.locator('main#contenido')).toHaveCount(1);

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
        expect.soft(
          indicator.outlineStyle !== 'none' && indicator.outlineWidth >= 1,
          `"${label}" has no focus outline (${JSON.stringify(indicator)})`,
        ).toBe(true);
      }
    });
  });
}
