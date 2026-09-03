/**
 * Open Graph cards, drawn at build time.
 *
 * Why a drawn card and not photography (plan §5b): three of nine image slots
 * have photos, Cupreata has none at all, and a share card that is a photo for
 * one lot and a blank for another is worse than a consistent set. So every
 * page gets the same branded card — paper, the wordmark, the lot's accent —
 * which also means a new lot needs no new asset, just its hue.
 *
 * Every mark on the card is a vector path:
 *   - the wordmark comes from the shared logo path set (src/lib/logo.ts);
 *   - all text is converted to outlines with opentype.js, from the same
 *     self-hosted woff2 faces the site serves.
 *
 * That last point is the whole reason this file exists in this shape. sharp
 * can rasterise `<text>`, but it resolves fonts through pango, which uses
 * CoreText on macOS and fontconfig on Linux — the `fontfile` option is
 * honoured on one and ignored on the other, so the same build produces
 * Spectral locally and a fallback sans in CI. Outlining the glyphs ourselves
 * removes font resolution from the build entirely: identical bytes on every
 * platform, and no dependency on what fonts the machine happens to have.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import opentype, { type Font, type Path, type PathCommand } from 'opentype.js';
import { decompress } from 'wawoff2';
import { accentHex } from './color';
import { LOGO_PATHS, LOGO_VIEWBOX } from './logo';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const PAPER = '#f7f5ee';
const INK = '#211d17';
/* The named ink alphas from tokens.css, as separate opacity values because
   librsvg has no `rgb(... / a)` shorthand support worth relying on. */
const RULE_OPACITY = 0.22;
const MUTED_OPACITY = 0.55;

const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');

type FaceName = 'serif' | 'mono' | 'mono-medium';

const FACE_FILES: Record<FaceName, string> = {
  serif: 'spectral-400.woff2',
  mono: 'plexmono-400.woff2',
  'mono-medium': 'plexmono-500.woff2',
};

const faceCache = new Map<FaceName, Promise<Font>>();

async function loadFace(face: FaceName): Promise<Font> {
  let pending = faceCache.get(face);
  if (!pending) {
    pending = (async () => {
      const woff2 = await readFile(path.join(FONT_DIR, FACE_FILES[face]));
      const sfnt = await decompress(woff2);
      /* Copy into a standalone ArrayBuffer: the Uint8Array from wawoff2 may be
         a view into a larger pool, and opentype.parse reads the whole buffer. */
      const bytes = Uint8Array.from(sfnt);
      return opentype.parse(bytes.buffer as ArrayBuffer);
    })();
    faceCache.set(face, pending);
  }
  return pending;
}

/**
 * Serialise glyph outlines to SVG path data.
 *
 * Deliberately not `Path.toPathData()`: opentype.js 2.0.0's own formatter
 * emits the literal string `NaN` for some coordinates when the run starts at
 * a fractional x (reproduced with "Destilado de agave" at x = 475.935). A
 * path is parsed left to right, so librsvg silently drops everything after
 * the bad token — the card renders with the text cut off mid-word and no
 * error anywhere. Writing the numbers here avoids that path entirely, and
 * every coordinate is checked, so a bad glyph fails the build instead of
 * quietly truncating a share card.
 */
function serializePath(outline: Path): string {
  const round = (value: number): string => {
    if (!Number.isFinite(value)) {
      throw new Error(`Glyph outline produced a non-finite coordinate (${value}).`);
    }
    return String(Math.round(value * 100) / 100);
  };

  return outline.commands
    .map((command: PathCommand) => {
      switch (command.type) {
        case 'M':
        case 'L':
          return `${command.type}${round(command.x)} ${round(command.y)}`;
        case 'Q':
          return `Q${round(command.x1)} ${round(command.y1)} ${round(command.x)} ${round(command.y)}`;
        case 'C':
          return (
            `C${round(command.x1)} ${round(command.y1)} ` +
            `${round(command.x2)} ${round(command.y2)} ` +
            `${round(command.x)} ${round(command.y)}`
          );
        case 'Z':
          return 'Z';
      }
    })
    .join('');
}

interface TextOptions {
  face: FaceName;
  size: number;
  /** Tracking in em, matching the CSS `--track-*` tokens. */
  tracking?: number;
  fill?: string;
  opacity?: number;
  align?: 'left' | 'center' | 'right';
  /** Shrink the type until the run fits this width. */
  maxWidth?: number;
}

/**
 * One run of text as an SVG `<path>`, positioned by baseline.
 * `x` is the left edge, or the centre when `align: 'center'`.
 */
async function textPath(
  content: string,
  x: number,
  baseline: number,
  options: TextOptions,
): Promise<string> {
  const font = await loadFace(options.face);
  const tracking = options.tracking ?? 0;
  const renderOptions = { kerning: true, letterSpacing: tracking };

  let size = options.size;
  let width = font.getAdvanceWidth(content, size, renderOptions);
  if (options.maxWidth && width > options.maxWidth) {
    size = size * (options.maxWidth / width);
    width = font.getAdvanceWidth(content, size, renderOptions);
  }

  /* Trailing letter-spacing is included in the advance; drop it so a tracked
     run still centres on its ink rather than half a space to the left. */
  const inkWidth = width - tracking * size;
  const left =
    options.align === 'center' ? x - inkWidth / 2 : options.align === 'right' ? x - inkWidth : x;

  const data = serializePath(font.getPath(content, left, baseline, size, renderOptions));
  const fill = options.fill ?? INK;
  const opacity = options.opacity === undefined ? '' : ` opacity="${options.opacity}"`;
  return `<path d="${data}" fill="${fill}"${opacity}/>`;
}

/**
 * The wordmark (or mark) at a given box. Nested <svg> so the variant viewBox
 * crops the shared artwork exactly as the Logo component does.
 */
function logo(
  variant: 'mark' | 'word',
  x: number,
  y: number,
  width: number,
  fill: string,
  opacity = 1,
): string {
  const [, , boxW, boxH] = LOGO_VIEWBOX[variant].split(' ').map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const height = (width * boxH) / boxW;
  return (
    `<svg x="${x}" y="${y}" width="${width}" height="${height}" ` +
    `viewBox="${LOGO_VIEWBOX[variant]}" fill="${fill}" opacity="${opacity}">` +
    LOGO_PATHS.map((d) => `<path d="${d}"/>`).join('') +
    `</svg>`
  );
}

function hairline(x1: number, x2: number, y: number): string {
  return (
    `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" ` +
    `stroke="${INK}" stroke-opacity="${RULE_OPACITY}" stroke-width="1"/>`
  );
}

const PAD = 76;
const RIGHT = OG_WIDTH - PAD;

export interface LotCard {
  kind: 'lot';
  /** "MICROLOTE 01" */
  eyebrow: string;
  /** "GRO·EM·26" */
  code: string;
  /** "Espadín — Mexicano" */
  name: string;
  /** "SIERRA NORTE, GUERRERO" */
  locality: string;
  /** "COSECHA 2026" */
  harvest: string;
  accentHue: number;
}

export interface SiteCard {
  kind: 'site';
  tagline: string;
  lede: string;
  accentHue: number;
}

export type CardSpec = LotCard | SiteCard;

async function lotSvg(card: LotCard): Promise<string> {
  const accent = accentHex(card.accentHue);
  const parts = await Promise.all([
    Promise.resolve(logo('word', PAD, 72, 300, INK)),
    Promise.resolve(hairline(PAD, RIGHT, 150)),
    /* Eyebrow: the accent dot, then the microlote line — the same pairing the
       lot hero uses. The dot sits on the mono cap-height, not the baseline. */
    Promise.resolve(`<circle cx="${PAD + 7}" cy="322" r="7" fill="${accent}"/>`),
    textPath(`${card.eyebrow} — ${card.code}`, PAD + 30, 329, {
      face: 'mono-medium',
      size: 21,
      tracking: 0.16,
      fill: accent,
    }),
    textPath(card.name, PAD, 440, {
      face: 'serif',
      size: 96,
      maxWidth: RIGHT - PAD,
    }),
    Promise.resolve(hairline(PAD, RIGHT, 512)),
    textPath(card.locality, PAD, 560, {
      face: 'mono',
      size: 19,
      tracking: 0.12,
      opacity: MUTED_OPACITY,
    }),
    textPath(card.harvest, RIGHT, 560, {
      face: 'mono',
      size: 19,
      tracking: 0.12,
      opacity: MUTED_OPACITY,
      align: 'right',
    }),
  ]);
  return parts.join('');
}

async function siteSvg(card: SiteCard): Promise<string> {
  const accent = accentHex(card.accentHue);
  const centre = OG_WIDTH / 2;
  const parts = await Promise.all([
    Promise.resolve(logo('mark', centre - 66, 132, 132, INK)),
    Promise.resolve(logo('word', centre - 230, 330, 460, INK)),
    textPath(card.lede, centre, 434, {
      face: 'serif',
      size: 30,
      align: 'center',
      opacity: 0.7,
    }),
    Promise.resolve(`<circle cx="${centre}" cy="486" r="6" fill="${accent}"/>`),
    textPath(card.tagline, centre, 546, {
      face: 'mono',
      size: 18,
      tracking: 0.16,
      align: 'center',
      opacity: MUTED_OPACITY,
    }),
  ]);
  return parts.join('');
}

/** The full card as an SVG document. Exported for testing. */
export async function cardSvg(card: CardSpec): Promise<string> {
  const body = card.kind === 'lot' ? await lotSvg(card) : await siteSvg(card);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" ` +
    `viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">` +
    `<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${PAPER}"/>` +
    body +
    `</svg>`
  );
}

/**
 * Rasterise a card, and refuse to emit a broken one.
 *
 * A share card that renders blank is worse than no card at all, and it fails
 * silently — nothing on the site links to it visually. So the render is
 * checked before it is returned: right dimensions, and actual variation in
 * the pixels. A uniform image means the artwork did not draw.
 */
export async function renderCard(card: CardSpec): Promise<Buffer> {
  const svg = await cardSvg(card);
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

  const image = sharp(png);
  const [metadata, stats] = await Promise.all([image.metadata(), image.stats()]);
  if (metadata.width !== OG_WIDTH || metadata.height !== OG_HEIGHT) {
    throw new Error(
      `OG card rendered at ${metadata.width}x${metadata.height}, expected ${OG_WIDTH}x${OG_HEIGHT}.`,
    );
  }
  /* RGB only. An opaque card has a constant alpha channel, whose stdev is
     legitimately zero — including it would make this check always fire. */
  const flattest = Math.min(...stats.channels.slice(0, 3).map((channel) => channel.stdev));
  if (flattest < 1) {
    throw new Error(
      'OG card rendered as a flat field — the artwork did not draw. ' +
        `Lowest per-channel stdev was ${flattest.toFixed(3)}.`,
    );
  }
  return png;
}
