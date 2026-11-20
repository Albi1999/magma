import { semantic } from '@maggioli-design-system/design-tokens/semantic.config';
import { msg, type T } from './i18n.js';

/*
  The preview of a transparent role (#1472): the band that holds the options you pick from and the
  track of a quantity, each the ink at an alpha times one intensity, so the surface beneath shows
  through. Every component of the category is drawn on the grounds it lands on, the page, a card,
  a well and a coloured fill, in a page of its own (roles.html) per mode, and the distance and the
  ratio of its band or track to the ground are measured under it, as the board of the tracks
  measured them (2026-11-20): when the theme moves an alpha or the intensity, every case of the
  role is seen at once.

  What is measured: the colour the browser computes for the part (a mix with `transparent` comes
  back as `oklab(... / alpha)`), laid over the ground the way the browser composites it (sRGB,
  channel by channel); the distance is OKLab L x 100 (negative = darker), the ratio WCAG 2.
*/

export type RoleId = 'band' | 'track';

/** A colour in sRGB 0-255 and its alpha 0-1. */
export type Rgba = [number, number, number, number];

/** A ground a role lies on: the background of its cell. */
export interface Ground {
  id: 'page' | 'card' | 'well' | 'fill';
  label: string;
  background: string;
}

/**
 * The grounds of the board of the tracks: the three surfaces a component lies on and a coloured
 * fill (a banner), which declares no surface.
 */
export const GROUNDS: readonly Ground[] = [
  { id: 'page', label: msg('Page'), background: 'var(--magma-surface-default)' },
  { id: 'card', label: msg('Card'), background: 'var(--magma-surface-raised)' },
  { id: 'well', label: msg('Well'), background: 'var(--magma-surface-sunken)' },
  { id: 'fill', label: msg('Coloured fill'), background: 'var(--magma-info-wash-base)' },
];

/** A part measured in a cell: the element that paints it, and the part it lies on, if not the ground. */
export interface Part {
  label: string;
  element: Element | null | undefined;
  on?: string;
}

/** A component of the category: its markup and the parts of it that paint the role. */
export interface RoleRow {
  id: string;
  label: string;
  html: (t: T) => string;
  parts: (host: Element) => Part[];
}

const BAND = msg('band');
const SELECTED = msg('selected');
const TRACK = msg('track');

/** The value of an attribute, quoted. */
const attr = (value: string) => `"${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;

/** The first element under `root` (its shadow tree first) that paints a background. */
export function painted(root: Element | null | undefined): Element | null {
  const queue: Element[] = root ? [root] : [];
  while (queue.length) {
    const one = queue.shift()!;
    // the window of the page the element is in: the frame, not the studio
    const view = one.ownerDocument.defaultView;
    const color = view ? parseColor(view.getComputedStyle(one).backgroundColor) : null;
    if (color && color[3] > 0) return one;
    queue.push(...(one.shadowRoot ? [...one.shadowRoot.children] : []), ...one.children);
  }
  return null;
}

const shadow = (host: Element, selector: string) => host.shadowRoot?.querySelector(selector);

/** The components of each role, as the board drew them. */
export const ROLES: Record<RoleId, { title: string; about: string; rows: RoleRow[] }> = {
  band: {
    title: msg('Band'),
    about: msg(
      'The band holds the options you pick from: the ink at {alpha} in light and {dark} in dark, times the intensity; the selected option is the white chip in light, the ink at {selected} over the band in dark.',
    ),
    rows: [
      {
        id: 'tab',
        label: 'mds-tab',
        html: (t) =>
          `<mds-tab><mds-tab-item label=${attr(t('All'))} selected></mds-tab-item><mds-tab-item label=${attr(t('Open'))}></mds-tab-item><mds-tab-item label=${attr(t('Closed'))}></mds-tab-item></mds-tab>`,
        parts: (host) => [
          { label: BAND, element: shadow(host, '.tabs') },
          { label: SELECTED, element: shadow(host, '.slider'), on: BAND },
        ],
      },
      {
        id: 'filter',
        label: 'mds-filter',
        html: (t) =>
          `<mds-filter label=${attr(t('Status'))}><mds-filter-item label=${attr(t('All'))} value="all"></mds-filter-item><mds-filter-item label=${attr(t('Open'))} value="open" count="12" selected></mds-filter-item><mds-filter-item label=${attr(t('Closed'))} value="closed" count="3"></mds-filter-item></mds-filter>`,
        parts: (host) => [
          { label: BAND, element: shadow(host, '.items') },
          { label: SELECTED, element: host.querySelector('mds-filter-item[selected]'), on: BAND },
        ],
      },
      {
        id: 'paginator',
        label: 'mds-paginator',
        html: () => '<mds-paginator pages="8" current-page="3"></mds-paginator>',
        parts: (host) => [{ label: BAND, element: shadow(host, '.pages') }],
      },
    ],
  },
  track: {
    title: msg('Track'),
    about: msg(
      'The track is the ground of a quantity: the ink at {alpha} in light and {dark} in dark, times the intensity; the fill of the quantity stays opaque.',
    ),
    rows: [
      {
        id: 'progress',
        label: 'mds-progress',
        html: (t) =>
          `<mds-progress progress="0.4" direction="horizontal" aria-label=${attr(t('Progress'))}></mds-progress>`,
        parts: (host) => [{ label: TRACK, element: painted(host) }],
      },
      {
        id: 'range',
        label: 'mds-input-range',
        html: (t) => `<mds-input-range value="40"><span>${t('Volume')}</span></mds-input-range>`,
        parts: (host) => [{ label: TRACK, element: shadow(host, '.track-total') }],
      },
      {
        id: 'radial',
        label: 'mds-radial-progress',
        html: () => '<mds-radial-progress progress="0.4"></mds-radial-progress>',
        parts: (host) => [{ label: TRACK, element: host }],
      },
      {
        id: 'stepper',
        label: 'mds-stepper-bar',
        html: (t) =>
          `<mds-stepper-bar items-done="1"><mds-stepper-bar-item icon="mi/baseline/person" icon-checked="mi/baseline/done" label=${attr(t('Account'))}></mds-stepper-bar-item><mds-stepper-bar-item icon="mi/baseline/badge" icon-checked="mi/baseline/done" label=${attr(t('Profile'))}></mds-stepper-bar-item><mds-stepper-bar-item icon="mi/baseline/home" icon-checked="mi/baseline/done" label=${attr(t('Address'))}></mds-stepper-bar-item></mds-stepper-bar>`,
        // the line of the last step, not reached: an mds-progress inside its shadow tree
        parts: (host) => [
          {
            label: TRACK,
            element: painted(
              shadow([...host.querySelectorAll('mds-stepper-bar-item')].pop()!, '.progress'),
            ),
          },
        ],
      },
    ],
  },
};

/** The alphas of a role in each mode, in percent, as the layer declares them. */
export function alphasOf(role: RoleId): { light: number; dark: number; selected?: number } {
  const { roles } = semantic.transparent;
  const own = roles[role].alpha;
  const selected = role === 'band' ? roles['band-selected']?.alpha.dark : undefined;
  return {
    light: own.light ?? 0,
    dark: own.dark ?? 0,
    ...(selected === undefined ? {} : { selected }),
  };
}

/** The grid of a role on its grounds: a row per component, a cell per ground, a line for the measure. */
export function rolesMarkup(role: RoleId, t: T): string {
  const { rows } = ROLES[role];
  const head = `<div></div>${GROUNDS.map((ground) => `<div class="roles-ground">${t(ground.label)}</div>`).join('')}`;
  const body = rows
    .map(
      (row) =>
        `<div class="roles-name"><code>${row.label}</code></div>${GROUNDS.map(
          (ground) =>
            `<div class="roles-cell" data-row="${row.id}" data-ground="${ground.id}" style="background-color: ${ground.background}"><div class="roles-slot">${row.html(t)}</div><p class="roles-measure"></p></div>`,
        ).join('')}`,
    )
    .join('');
  return `<div class="roles-grid" data-role="${role}" style="--roles-grounds: ${GROUNDS.length}">${head}${body}</div>`;
}

// --- colours: what the browser computes, read back in sRGB --------------------------------------

const encode = (c: number) =>
  255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const decode = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const clamp = (c: number) => Math.min(255, Math.max(0, c));
const number = (value: string, whole = 1) =>
  value.endsWith('%') ? (parseFloat(value) / 100) * whole : parseFloat(value);

/** OKLab to sRGB 0-255, Ottosson's reference matrices. */
function oklabToRgb(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    clamp(encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    clamp(encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    clamp(encode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  ];
}

/**
 * A colour as `getComputedStyle` writes it: `rgb()` / `rgba()`, `oklab()` (a `color-mix()` in
 * oklab comes back so) and `color(srgb ...)`; null for anything else (`transparent` is rgba).
 */
export function parseColor(css: string | null | undefined): Rgba | null {
  if (!css) return null;
  const match = /^(rgba?|oklab|color)\((.*)\)$/i.exec(css.trim());
  if (!match) return null;
  const [kind, inner] = [match[1].toLowerCase(), match[2]];
  const [channels, alphaPart] = inner.includes('/') ? inner.split('/') : [inner, undefined];
  const values = channels.trim().split(/[\s,]+/);
  const alpha = (fallback?: string) => {
    const given = alphaPart ?? fallback;
    return given === undefined ? 1 : number(given.trim());
  };
  if (kind === 'rgb' || kind === 'rgba') {
    const [r, g, b, a] = values;
    return [number(r, 255), number(g, 255), number(b, 255), alpha(a)];
  }
  if (kind === 'oklab') {
    const [L, a, b] = values;
    return [...oklabToRgb(number(L), number(a, 0.4), number(b, 0.4)), alpha()];
  }
  if (values[0] !== 'srgb') return null;
  const [, r, g, b] = values;
  return [number(r) * 255, number(g) * 255, number(b) * 255, alpha()];
}

/** A colour laid over an opaque one, as the browser composites it: gamma-encoded sRGB. */
export const over = (top: Rgba, under: Rgba): Rgba => [
  top[0] * top[3] + under[0] * (1 - top[3]),
  top[1] * top[3] + under[1] * (1 - top[3]),
  top[2] * top[3] + under[2] * (1 - top[3]),
  1,
];

/** OKLab L x 100 of an sRGB colour. */
export function lightness([r, g, b]: Rgba): number {
  const [R, G, B] = [decode(r), decode(g), decode(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return (0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s) * 100;
}

/** The WCAG 2 ratio of two opaque colours. */
export function ratio(a: Rgba, b: Rgba): number {
  const Y = ([r, g, bl]: Rgba) => 0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(bl);
  const [x, y] = [Y(a), Y(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** A part measured: its distance (OKLab L x 100, negative = darker) and ratio to what it lies on. */
export interface Measure {
  label: string;
  on?: string;
  distance: number;
  ratio: number;
}

/**
 * Every part of a cell, laid over its ground or over the part it lies on: the band over the
 * ground, the selected option over the band.
 */
export function measureCell(
  ground: Rgba,
  parts: Array<{ label: string; color: Rgba | null; on?: string }>,
): Measure[] {
  const shown = new Map<string, Rgba>();
  return parts.flatMap(({ label, color, on }) => {
    const under = (on && shown.get(on)) || ground;
    if (!color) return [];
    const seen = over(color, under);
    shown.set(label, seen);
    return [
      {
        label,
        ...(on ? { on } : {}),
        distance: lightness(seen) - lightness(under),
        ratio: ratio(seen, under),
      },
    ];
  });
}

/** The line under a cell: each part with its distance and its ratio. */
export function measureLine(measures: Measure[], t: T): string {
  return measures
    .map(({ label, on, distance, ratio: value }) => {
      const sign = distance >= 0 ? '+' : '';
      return on
        ? t('{part} {distance} ({ratio}:1 on the {on})', {
            part: t(label),
            distance: `${sign}${distance.toFixed(1)}`,
            ratio: value.toFixed(2),
            on: t(on),
          })
        : t('{part} {distance} ({ratio}:1)', {
            part: t(label),
            distance: `${sign}${distance.toFixed(1)}`,
            ratio: value.toFixed(2),
          });
    })
    .join(' · ');
}

/**
 * Ends the transitions and the animations of a page, its shadow trees included, after the styles
 * are computed again: a component that fades its background (`transition-property:
 * background-color`) reads back the colour it starts from until it ends, and the measure is of
 * the colour it lands on.
 */
export function finishAnimations(page: Document) {
  page.body?.getBoundingClientRect();
  const roots: Array<Document | ShadowRoot> = [page];
  for (let index = 0; index < roots.length; index++)
    for (const element of roots[index].querySelectorAll('*'))
      if (element.shadowRoot) roots.push(element.shadowRoot);
  for (const root of roots)
    for (const animation of root.getAnimations?.() ?? [])
      try {
        animation.finish();
      } catch {
        // an animation with no end (infinite) keeps running
      }
}

/** Measures every cell of the grid of a page and writes the line under it; returns the measures. */
export function measurePage(page: Document, role: RoleId, t: T): Record<string, Measure[]> {
  const view = page.defaultView;
  const out: Record<string, Measure[]> = {};
  if (!view) return out;
  finishAnimations(page);
  for (const cell of page.querySelectorAll<HTMLElement>('.roles-cell')) {
    const row = ROLES[role].rows.find((one) => one.id === cell.dataset.row);
    const host = cell.querySelector('.roles-slot')?.firstElementChild;
    if (!row || !host) continue;
    const ground = parseColor(view.getComputedStyle(cell).backgroundColor);
    if (!ground) continue;
    const measures = measureCell(
      ground,
      row.parts(host).map(({ label, element, on }) => ({
        label,
        on,
        color: element ? parseColor(view.getComputedStyle(element).backgroundColor) : null,
      })),
    );
    out[`${cell.dataset.row}/${cell.dataset.ground}`] = measures;
    const line = cell.querySelector('.roles-measure');
    if (line) line.textContent = measureLine(measures, t);
  }
  return out;
}
