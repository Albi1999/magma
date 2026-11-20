// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { h, render } from 'preact'
import { act } from 'preact/test-utils'
import initialConfig from '@maggioli-design-system/design-tokens/.magma-design-tokensrc.json'
import type { MagmaConfig } from '@maggioli-design-system/design-tokens/src/lib/color.mjs'
import { LangProvider } from '../src/i18n.js'
import { RolesPreview } from '../src/roles-page.js'
import {
  GROUNDS,
  ROLES,
  alphasOf,
  lightness,
  measureCell,
  measureLine,
  measurePage,
  over,
  parseColor,
  ratio,
  rolesMarkup,
  type Rgba,
} from '../src/roles.js'

// The page Band and track (#1472): a preview per transparent role, its components on the page, a
// card, a well and a coloured fill, in a frame per mode, with the distance and the ratio under
// each. jsdom loads no page in a frame and upgrades no mds-*: the test gives each frame the <main>
// of roles.html, fires its load, and reads what the page writes there.

const en = (text: string, values: Record<string, string | number> = {}) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`))

test('a computed colour is read back in sRGB, the mix of oklab with its alpha too', () => {
  expect(parseColor('rgb(242, 242, 242)')).toEqual([242, 242, 242, 1])
  expect(parseColor('rgba(5, 5, 5, 0.0451)')).toEqual([5, 5, 5, 0.0451])
  expect(parseColor('color(srgb 1 0.5 0 / 0.5)')).toEqual([255, 127.5, 0, 0.5])
  // what Chromium computes for color-mix(in oklab, #050505 4.51%, transparent)
  const ink = parseColor('oklab(0.114918 0.00000522286 0.00000230223 / 0.0451)')!
  expect(ink.slice(0, 3).map(Math.round)).toEqual([5, 5, 5])
  expect(ink[3]).toBe(0.0451)
  expect(parseColor('transparent')).toBeNull()
  expect(parseColor(undefined)).toBeNull()
})

test('a part is laid over its ground, and the selected option over the band', () => {
  const page: Rgba = [242, 242, 242, 1]
  expect(over([0, 0, 0, 0.5], [255, 255, 255, 1]).map(Math.round)).toEqual([128, 128, 128, 1])
  const [band, selected] = measureCell(page, [
    { label: 'band', color: [5, 5, 5, 0.0451] },
    { label: 'selected', color: [255, 255, 255, 1], on: 'band' },
  ])
  // the band of the board of the tracks, on the page in light: about 3.2 below it, 1.1:1 (the
  // decided 3.3 was solved through an 8-bit canvas, design-tokens test/transparent.test.mts)
  expect(band.distance).toBeCloseTo(-3.2, 1)
  expect(band.ratio).toBeCloseTo(1.1, 1)
  // the white chip is measured against the band it lies on, not against the page
  expect(selected.on).toBe('band')
  expect(selected.distance).toBeGreaterThan(-band.distance)
  expect(measureCell(page, [{ label: 'track', color: null }])).toEqual([])
  expect(lightness([255, 255, 255, 1])).toBeCloseTo(100, 1)
  expect(ratio([0, 0, 0, 1], [255, 255, 255, 1])).toBeCloseTo(21, 1)
  expect(measureLine([band, selected], en)).toBe('band -3.2 (1.10:1) · selected +7.1 (1.23:1 on the band)')
})

test('each role draws its components on the four grounds', () => {
  expect(GROUNDS.map((ground) => ground.background)).toEqual([
    'var(--magma-surface-default)',
    'var(--magma-surface-raised)',
    'var(--magma-surface-sunken)',
    'var(--magma-info-wash-base)',
  ])
  const page = document.implementation.createHTMLDocument('')
  page.body.innerHTML = rolesMarkup('band', en)
  expect(page.querySelectorAll('.roles-cell')).toHaveLength(ROLES.band.rows.length * GROUNDS.length)
  for (const tag of ['mds-tab', 'mds-filter', 'mds-paginator'])
    expect(page.querySelectorAll(`.roles-slot > ${tag}`), tag).toHaveLength(GROUNDS.length)
  page.body.innerHTML = rolesMarkup('track', en)
  for (const tag of ['mds-progress', 'mds-input-range', 'mds-radial-progress', 'mds-stepper-bar'])
    expect(page.querySelectorAll(`.roles-slot > ${tag}`), tag).toHaveLength(GROUNDS.length)
  // the alphas the layer declares, as the page says them
  expect(alphasOf('band')).toEqual({ light: 4.51, dark: 3.33, selected: 8.82 })
  expect(alphasOf('track')).toEqual({ light: 10.39, dark: 8.04 })
})

test('the measure of a cell is written under it', () => {
  // a document with a window, as the frame of the page has
  const frame = document.createElement('iframe')
  document.body.append(frame)
  const page = frame.contentDocument!
  page.body.innerHTML = rolesMarkup('band', en)
  const cell = page.querySelector<HTMLElement>('.roles-cell[data-row="paginator"][data-ground="page"]')!
  cell.style.backgroundColor = 'rgb(242, 242, 242)'
  const paginator = cell.querySelector('mds-paginator')!
  const pages = page.createElement('div')
  pages.className = 'pages'
  pages.style.backgroundColor = 'rgba(5, 5, 5, 0.0451)'
  paginator.attachShadow({ mode: 'open' }).append(pages)
  const measures = measurePage(page, 'band', en)
  expect(measures['paginator/page'].map(({ label }) => label)).toEqual(['band'])
  expect(cell.querySelector('.roles-measure')!.textContent).toBe('band -3.2 (1.10:1)')
  frame.remove()
})

const root = document.createElement('div')
document.body.append(root)
afterEach(() => act(() => render(null, root)))

const emit = (element: Element, type: string, detail?: unknown) =>
  act(() => {
    element.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }))
  })

/** The frames of the page, given the <main> of roles.html and loaded. */
const loaded = () => {
  const frames = [...root.querySelectorAll<HTMLIFrameElement>('iframe.roles-frame')]
  for (const frame of frames) {
    const page = frame.contentDocument!
    // jsdom loads nothing in the frame: the head and the body roles.html has
    if (!page.documentElement) page.append(page.createElement('html'))
    if (!page.head) page.documentElement.append(page.createElement('head'))
    if (!page.body) page.documentElement.append(page.createElement('body'))
    if (!page.getElementById('roles')) {
      const main = page.createElement('main')
      main.id = 'roles'
      page.body.append(main)
    }
    act(() => {
      frame.dispatchEvent(new Event('load'))
    })
  }
  return frames
}

test('the page shows a role in both modes and follows the intensity and the role chosen', () => {
  act(() =>
    render(h(LangProvider, { value: 'en' }, h(RolesPreview, { config: initialConfig as unknown as MagmaConfig })), root),
  )
  const frames = loaded()
  expect(frames.map((frame) => frame.getAttribute('title'))).toEqual([
    'Band on its grounds, light mode',
    'Band on its grounds, dark mode',
  ])
  const html = (index: number) => frames[index].contentDocument!.documentElement
  expect(html(0).classList.contains('pref-mode-light')).toBe(true)
  expect(html(1).classList.contains('pref-mode-dark')).toBe(true)
  for (const index of [0, 1]) {
    expect(html(index).style.getPropertyValue('--magma-wash-intensity')).toBe('1')
    expect(html(index).querySelectorAll('#roles .roles-slot > mds-tab')).toHaveLength(GROUNDS.length)
  }
  expect(root.querySelector('.roles-about')!.textContent).toContain('4.51%')

  // the intensity multiplies every alpha: it reaches both frames at once
  emit(root.querySelector('.roles-intensity mds-input-range')!, 'mdsInputRangeChange', 1.5)
  expect(root.querySelector('.roles-intensity mds-text')!.textContent).toBe('Wash intensity: 1.50')
  for (const index of [0, 1]) expect(html(index).style.getPropertyValue('--magma-wash-intensity')).toBe('1.5')

  // the track: its components in the same frames
  emit(root.querySelector('.roles-controls mds-tab')!, 'mdsTabChange', { id: 1, value: 'track' })
  expect(frames.map((frame) => frame.getAttribute('title'))).toEqual([
    'Track on its grounds, light mode',
    'Track on its grounds, dark mode',
  ])
  expect(html(0).querySelectorAll('#roles .roles-slot > mds-progress')).toHaveLength(GROUNDS.length)
  expect(root.querySelector('.roles-about')!.textContent).toContain('10.39%')
})
