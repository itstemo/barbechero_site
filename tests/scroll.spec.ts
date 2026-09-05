import { expect, test } from '@playwright/test';

const MEDIA_ROUTE = '/lote/oax-cy-26/';
const MEDIA_ROUTES = ['/lote/gro-em-26/', MEDIA_ROUTE];
const GALLERY_SIZES =
  '(min-width: 1280px) 250px, (min-width: 1240px) calc(298px - 3.75vw), ' +
  '(min-width: 998px) calc(21.25vw - 12px), (min-width: 900px) calc(30vw - 16px), 260px';

const GALLERY_WIDTHS = [240, 390, 768, 899, 900, 997, 998, 999, 1000, 1239, 1240, 1279, 1280] as const;

function contentWidth(width: number): number {
  return width < 640 ? width - 40 : Math.min(width - 48, 1192);
}

function expectedGalleryWidth(width: number): number {
  return width < 900 ? Math.min(260, contentWidth(width)) : contentWidth(width);
}

function declaredImageWidth(width: number): number {
  if (width >= 1280) return 250;
  if (width >= 1240) return 298 - 3.75 * (width / 100);
  if (width >= 998) return 21.25 * (width / 100) - 12;
  if (width >= 900) return 30 * (width / 100) - 16;
  return 260;
}

async function readGalleryLayout(page: import('@playwright/test').Page) {
  const gallery = page.locator('.lot-gallery');
  const image = gallery.locator('img').first();
  await gallery.scrollIntoViewIfNeeded();
  await expect
    .poll(
      () =>
        image.evaluate((candidate) => {
          const img = candidate as HTMLImageElement;
          return img.complete && img.naturalWidth > 0;
        }),
      {
        message: 'the first gallery image should load after the gallery enters the viewport',
      },
    )
    .toBe(true);

  return gallery.evaluate((gallery) => {
    const image = gallery.querySelector('img') as HTMLImageElement | null;
    const item = gallery.querySelector('.lot-gallery__item');
    return {
      galleryWidth: gallery.getBoundingClientRect().width,
      itemWidth: item?.getBoundingClientRect().width ?? 0,
      sizes: image?.getAttribute('sizes'),
      currentSrc: image?.currentSrc ?? '',
      srcset: image?.getAttribute('srcset') ?? '',
      lazy: [...gallery.querySelectorAll('img')].every(
        (candidate) => candidate.getAttribute('loading') === 'lazy',
      ),
    };
  });
}

test.describe('lot media scrolling behavior', () => {
  test('media columns remain normal flow instead of pretending to be sticky', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 844 });

    for (const route of MEDIA_ROUTES) {
      await page.goto(route);
      const positions = await page.locator('.section__media').evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).position),
      );

      expect(positions.length, `${route} should render media`).toBeGreaterThan(0);
      expect(positions.every((position) => position === 'static')).toBe(true);
      await expect(page.locator('.section__media-pin')).toHaveCount(0);
    }
  });

  for (const width of GALLERY_WIDTHS) {
    test(`gallery sizing remains aligned at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(MEDIA_ROUTE);

      const layout = await readGalleryLayout(page);
      expect(Math.abs(layout.galleryWidth - expectedGalleryWidth(width))).toBeLessThanOrEqual(0.5);
      expect(layout.itemWidth).toBeGreaterThan(0);
      expect(layout.sizes).toBe(GALLERY_SIZES);
      expect(layout.currentSrc).toContain('/_astro/');
      expect(layout.lazy).toBe(true);
      expect(layout.srcset).toContain('260w');
      expect(layout.srcset).toContain('780w');

      if (width >= 900) {
        expect(Math.abs(layout.itemWidth - declaredImageWidth(width))).toBeLessThanOrEqual(2.5);
      }
    });
  }

  test('the gallery and map stay inside the main content box on a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 240, height: 844 });
    await page.goto(MEDIA_ROUTE);

    const boxes = await page.evaluate(() => {
      const box = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      };
      return {
        main: box('main'),
        gallery: box('.lot-gallery'),
        map: box('.lot-map'),
      };
    });

    expect(boxes.main, 'main content should render').not.toBeNull();
    expect(boxes.gallery, 'gallery should render').not.toBeNull();
    expect(boxes.map, 'map should render').not.toBeNull();

    expect(boxes.gallery!.left).toBeGreaterThanOrEqual(boxes.main!.left - 0.5);
    expect(boxes.gallery!.right).toBeLessThanOrEqual(boxes.main!.right + 0.5);
    expect(boxes.map!.left).toBeGreaterThanOrEqual(boxes.main!.left - 0.5);
    expect(boxes.map!.right).toBeLessThanOrEqual(boxes.main!.right + 0.5);
  });

  for (const width of [390, 1280]) {
    test(`the static map remains rendered at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(MEDIA_ROUTE);

      const map = page.locator('.lot-map');
      await expect(map).toHaveCount(1);
      const layout = await map.evaluate((element) => {
        const frame = element.querySelector('.lot-map__frame')?.getBoundingClientRect();
        const base = element.querySelector('.lot-map__base')?.getBoundingClientRect();
        const box = element.getBoundingClientRect();
        return {
          width: box.width,
          right: box.right,
          frameWidth: frame?.width ?? 0,
          frameHeight: frame?.height ?? 0,
          baseWidth: base?.width ?? 0,
          baseHeight: base?.height ?? 0,
          position: getComputedStyle(element).position,
        };
      });

      expect(layout.width).toBeGreaterThan(0);
      expect(layout.frameWidth).toBeGreaterThan(0);
      expect(layout.frameHeight).toBeGreaterThan(0);
      expect(layout.baseWidth).toBeGreaterThan(0);
      expect(layout.baseHeight).toBeGreaterThan(0);
      expect(layout.right).toBeLessThanOrEqual(width + 0.5);
      expect(layout.position).toBe('static');
    });
  }

  for (const route of MEDIA_ROUTES) {
    test(`only the first lot image is eager and high priority on ${route}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(route);

      const lotImages = await page.locator('.lot-media img').evaluateAll((images) =>
        images.map((image) => ({
          loading: image.getAttribute('loading'),
          priority: image.getAttribute('fetchpriority'),
        })),
      );
      const galleryPriorities = await page.locator('.lot-gallery img').evaluateAll((images) =>
        images.map((image) => ({
          loading: image.getAttribute('loading'),
          priority: image.getAttribute('fetchpriority'),
        })),
      );

      expect(lotImages.length).toBeGreaterThan(0);
      expect(lotImages[0]).toEqual({ loading: 'eager', priority: 'high' });
      expect(lotImages.slice(1).every((image) => image.loading === 'lazy'))
        .toBe(true);
      expect(lotImages.slice(1).every((image) => image.priority !== 'high')).toBe(true);
      expect(galleryPriorities.every((image) => image.loading === 'lazy')).toBe(true);
      expect(galleryPriorities.every((image) => image.priority !== 'high')).toBe(true);
    });
  }
});
