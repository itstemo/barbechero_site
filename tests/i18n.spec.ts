import { expect, test } from '@playwright/test';
import { PAGE_PATHS, counterpartOf, localeOf } from './pages';

/**
 * The bilingual contract, asserted on the built site.
 *
 * The failure this guards against is not a broken link — it is a toggle that
 * *works* while quietly dropping the reader back on the home page, which is
 * the usual way a language switcher is wrong. So the assertion is that the
 * toggle round-trips: follow it, follow it back, land where you started.
 */

/** The Spanish and English halves of the sitemap. */
const SPANISH = PAGE_PATHS.filter((path) => localeOf(path) === 'es');
const ENGLISH = PAGE_PATHS.filter((path) => localeOf(path) === 'en');

test('both languages are published, page for page', () => {
  expect(ENGLISH.map(counterpartOf).sort()).toEqual([...SPANISH].sort());
});

for (const path of PAGE_PATHS) {
  test.describe(`${path}`, () => {
    /*
     * One load: the toggle links and the foreign-text check both need the
     * page as loaded, so they run first; the round trip navigates away and
     * back afterwards.
     */
    test('language toggle: links, round trip, no cross-language text', async ({ page }) => {
      await page.goto(path);

      const group = page.locator('[role="group"]').filter({ hasText: /ES/ }).first();
      await expect(group).toBeVisible();

      const links = group.locator('a[href]');
      await expect(links).toHaveCount(2);

      const hrefs = await links.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('href')),
      );
      expect(hrefs, 'the toggle offers this page and its counterpart').toEqual(
        expect.arrayContaining([path, counterpartOf(path)]),
      );

      /* The link you are already on is marked, so a screen reader is not
         told to switch to the language it is already reading. */
      const current = group.locator('a[aria-current="true"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveAttribute('href', path);

      const text = (await page.locator('body').innerText()).toUpperCase();

      /* Spot-checks, not a translation audit: these are the strings that
         would still be Spanish if a template forgot to localize — the
         footer warning, the section eyebrows, the nav. Terms of art that
         stay Spanish on purpose (PALENQUE, MÉTODO FILIPINO) are not here. */
      const spanishOnly = ['NOCIVO PARA LA SALUD', 'EL AGAVE', 'LA FICHA', 'SIGUIENTE'];
      const englishOnly = ['HARMFUL TO HEALTH', 'THE AGAVE', 'THE SPEC SHEET', 'NEXT —'];
      const forbidden = localeOf(path) === 'es' ? englishOnly : spanishOnly;

      for (const phrase of forbidden) {
        expect(text, `${path} should not contain "${phrase}"`).not.toContain(phrase);
      }

      const counterpart = counterpartOf(path);

      await page.locator(`[role="group"] a[href="${counterpart}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${counterpart.replace(/\//g, '\\/')}$`));
      await expect(page.locator('html')).toHaveAttribute('lang', localeOf(counterpart));

      await page.locator(`[role="group"] a[href="${path}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`));
      await expect(page.locator('html')).toHaveAttribute('lang', localeOf(path));
    });
  });
}
