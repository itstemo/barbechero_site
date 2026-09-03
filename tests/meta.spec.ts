import { expect, test } from '@playwright/test';
import { PAGE_PATHS } from './pages';

/**
 * Metadata is asserted for the same reason the layout is: none of it is
 * visible on the page, so a missing canonical or a duplicated description
 * survives any amount of looking at the site.
 */

const SITE = 'https://barbechero.com';

/** Width and height straight out of a PNG's IHDR chunk. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(bytes.subarray(0, 8).equals(signature), 'file is a PNG').toBe(true);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('every page has a unique title and description', async ({ page }) => {
  const seen = new Map<string, string[]>();

  for (const path of PAGE_PATHS) {
    await page.goto(path);
    const title = await page.title();
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');

    expect(title.length, `${path}: title is set`).toBeGreaterThan(10);
    expect(description, `${path}: description is set`).toBeTruthy();
    expect(description!.length, `${path}: description length`).toBeGreaterThan(50);
    expect(description!.length, `${path}: description length`).toBeLessThan(200);

    for (const [key, value] of [
      ['title', title],
      ['description', description!],
    ] as const) {
      const bucket = seen.get(`${key}:${value}`) ?? [];
      bucket.push(path);
      seen.set(`${key}:${value}`, bucket);
    }
  }

  const duplicates = [...seen.entries()].filter(([, paths]) => paths.length > 1);
  expect(duplicates, `duplicated metadata: ${JSON.stringify(duplicates)}`).toEqual([]);
});

for (const path of PAGE_PATHS) {
  test.describe(`${path}`, () => {
    test('declares Spanish, a canonical URL and a viewport', async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${SITE}${path}`,
      );
      await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
        'content',
        /width=device-width/,
      );
    });

    test('carries a complete Open Graph and Twitter card', async ({ page, request }) => {
      await page.goto(path);

      const title = await page.title();
      const description = await page
        .locator('meta[name="description"]')
        .getAttribute('content');

      const meta = async (selector: string) =>
        page.locator(selector).first().getAttribute('content');

      expect(await meta('meta[property="og:title"]')).toBe(title);
      expect(await meta('meta[property="og:description"]')).toBe(description);
      expect(await meta('meta[property="og:url"]')).toBe(`${SITE}${path}`);
      expect(await meta('meta[property="og:type"]')).toBeTruthy();
      expect(await meta('meta[property="og:site_name"]')).toBe('Barbechero');
      expect(await meta('meta[property="og:locale"]')).toBe('es_MX');
      expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
      expect(await meta('meta[name="twitter:title"]')).toBe(title);
      expect(await meta('meta[name="twitter:description"]')).toBe(description);
      expect(await meta('meta[property="og:image:alt"]')).toBeTruthy();

      const image = await meta('meta[property="og:image"]');
      expect(image, 'og:image is absolute').toMatch(new RegExp(`^${SITE}/og/.+\\.png$`));
      expect(await meta('meta[name="twitter:image"]')).toBe(image);

      /* The declared dimensions have to be the real ones, and the file has to
         exist: an og:image that 404s is invisible until someone shares a link. */
      const response = await request.get(new URL(image!).pathname);
      expect(response.status(), `${image} is served`).toBe(200);
      const body = await response.body();
      expect(body.byteLength, `${image} is not empty`).toBeGreaterThan(2000);
      expect(pngSize(body)).toEqual({ width: 1200, height: 630 });
      expect(await meta('meta[property="og:image:width"]')).toBe('1200');
      expect(await meta('meta[property="og:image:height"]')).toBe('630');
    });
  });
}

test('robots.txt allows crawling and points at the sitemap', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain('User-agent: *');
  expect(body).toContain(`Sitemap: ${SITE}/sitemap-index.xml`);
});

test('the sitemap lists every page at the production origin', async ({ request }) => {
  const index = await request.get('/sitemap-index.xml');
  expect(index.status()).toBe(200);

  const response = await request.get('/sitemap-0.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();

  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);
  expect(locations.sort()).toEqual(PAGE_PATHS.map((path) => `${SITE}${path}`).sort());
});

test('the landing page carries Organization structured data and no commerce claims', async ({
  page,
}) => {
  await page.goto('/');
  const raw = await page.locator('script[type="application/ld+json"]').textContent();
  expect(raw, 'the landing page has JSON-LD').toBeTruthy();

  const data = JSON.parse(raw!);
  expect(data['@type']).toBe('Organization');
  expect(data.name).toBe('Barbechero');
  expect(data.url).toBe(`${SITE}/`);

  /*
   * This is an alcohol brand with no shop. Nothing in the structured data may
   * suggest a purchase path — no Product, no Offer, no price, no availability.
   */
  const serialized = JSON.stringify(data);
  for (const forbidden of ['Offer', 'price', 'availability', 'Product', 'sku']) {
    expect(serialized, `structured data must not mention "${forbidden}"`).not.toContain(
      forbidden,
    );
  }
});

test('lot pages ship no structured data implying a purchase', async ({ page }) => {
  for (const path of PAGE_PATHS.filter((candidate) => candidate !== '/')) {
    await page.goto(path);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    for (const block of blocks) {
      expect(block, `${path}: no Offer in structured data`).not.toContain('Offer');
      expect(block, `${path}: no Product in structured data`).not.toContain('Product');
    }
  }
});

test('the shipped site runs no client-side JavaScript', async ({ page }) => {
  const scripts: string[] = [];
  for (const path of PAGE_PATHS) {
    await page.goto(path);
    scripts.push(
      ...(await page.$$eval('script', (nodes) =>
        nodes
          .filter((node) => node.getAttribute('type') !== 'application/ld+json')
          .map((node) => node.getAttribute('src') ?? node.textContent ?? ''),
      )),
    );
  }
  expect(scripts, 'the only <script> allowed is the JSON-LD data block').toEqual([]);
});
