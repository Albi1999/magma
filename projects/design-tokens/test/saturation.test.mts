import { expect, test } from 'vitest'
import chroma from 'chroma-js'

import {
  hasSaturation,
  maxChroma,
  relativeSaturation,
  resolveStepSaturation,
  saturateStep,
  shiftSaturation,
} from '../src/lib/saturation.mjs'
import { createColorTokens, MagmaConfig } from '../src/lib/color.mjs'
import { contrast } from '../src/lib/leonardo/index.js'
import { validateConfig } from '../src/lib/schema.mjs'

const WHITE = '#ffffff'
const BLACK = '#000000'

const contrastOn = (color: string, background: string, formula: 'wcag2' | 'wcag3') =>
  Math.abs(contrast(chroma(color).rgb(), chroma(background).rgb(), undefined, formula))

const hueOf = (color: string) => chroma(color).oklch()[2]

test('hasSaturation detects a curve that changes some step', () => {
  expect(hasSaturation(undefined)).toBe(false)
  expect(hasSaturation({})).toBe(false)
  // both ends at 0: the flat curve, the scale as Leonardo makes it
  expect(hasSaturation({ dark: 0, light: 0, curve: 'hard' })).toBe(false)
  expect(hasSaturation({ light: 40 })).toBe(true)
  expect(hasSaturation({ dark: -20 })).toBe(true)
})

test('the amounts are anchored to physical lightness, as the hue shift', () => {
  const config = { dark: -30, light: 60, curve: 'hard' as const }
  // ratios run from the background outward: in light mode the near end is light, in dark mode dark
  expect(resolveStepSaturation(config, 10, 'light')).toEqual([60, 60, 60, 0, 0, 0, 0, -30, -30, -30])
  expect(resolveStepSaturation(config, 10, 'dark')).toEqual([-30, -30, -30, 0, 0, 0, 0, 60, 60, 60])
  // the smooth curve: the most at the ends, the least at the centre
  const smooth = resolveStepSaturation({ dark: 50, light: 50 }, 10, 'light')
  expect([smooth[0], smooth[9]]).toEqual([50, 50])
  expect(smooth[4]).toBeLessThan(smooth[0])
})

test('amounts out of range and bad curves are rejected, naming the saturation', () => {
  expect(() => resolveStepSaturation({ dark: 120 }, 10, 'light')).toThrow(/saturation dark .*-100, 100/)
  expect(() => resolveStepSaturation({ light: -101 }, 10, 'light')).toThrow(/saturation light/)
  expect(() => resolveStepSaturation({ light: 10, curve: 'bogus' as never }, 10, 'light')).toThrow(
    /saturation curve preset/,
  )
})

test('a positive amount closes the distance to the most vivid, a negative one moves toward grey', () => {
  expect(shiftSaturation(0.2, 0)).toBe(0.2)
  expect(shiftSaturation(0.2, 50)).toBeCloseTo(0.6)
  expect(shiftSaturation(0.2, 100)).toBe(1)
  expect(shiftSaturation(0.8, -50)).toBeCloseTo(0.4)
  expect(shiftSaturation(0.8, -100)).toBe(0)
})

test('the relative saturation is measured against the gamut of sRGB', () => {
  expect(relativeSaturation('#a3a3a3')).toBe(0)
  // a primary of sRGB is the most vivid colour at its lightness and hue
  expect(relativeSaturation('#0000ff')).toBeGreaterThan(0.99)
  // the pale grey-blue of the lightest step of brand.maggioli, before the curve
  expect(relativeSaturation('#ecedf0')).toBeLessThan(0.25)
  // at the lightness and hue of a pale blue there is room for more chroma; at white there is none
  const [lightness, chromaValue, hue] = chroma('#c8d2fd').oklch()
  expect(maxChroma(lightness, hue)).toBeGreaterThan(chromaValue)
  // the edge agrees with chroma-js, whose OKLab goes through XYZ: a hair inside, a hair outside
  expect(chroma.oklch(lightness, maxChroma(lightness, hue) * 0.999, hue).clipped()).toBe(false)
  expect(chroma.oklch(lightness, maxChroma(lightness, hue) * 1.01, hue).clipped()).toBe(true)
  expect(maxChroma(1, hue)).toBeLessThan(0.001)
})

test('a saturated step keeps its hue and never falls under the contrast of its target', () => {
  const cases = [
    { color: '#ecedf0', target: 8, background: WHITE, formula: 'wcag3' as const },
    { color: '#94acda', target: 45, background: WHITE, formula: 'wcag3' as const },
    { color: '#0446c3', target: 34, background: BLACK, formula: 'wcag3' as const },
    { color: '#a5e1ba', target: 1.42, background: WHITE, formula: 'wcag2' as const },
    { color: '#00742e', target: 3.29, background: BLACK, formula: 'wcag2' as const },
  ]
  for (const { color, target, background, formula } of cases) {
    for (const amount of [-80, -30, 30, 80]) {
      const saturated = saturateStep(color, amount, target, background, formula)
      expect(contrastOn(saturated, background, formula)).toBeGreaterThanOrEqual(target)
      // the solve lands right at the target, not anywhere above it
      expect(contrastOn(saturated, background, formula)).toBeLessThan(target * 1.06)
      const before = relativeSaturation(color)
      const after = relativeSaturation(saturated)
      // a step already at the most vivid colour has nowhere to go but down
      if (amount > 0) expect(after).toBeGreaterThan(Math.min(before, 0.98))
      else expect(after).toBeLessThan(before)
      // the OKLCH hue stays; a step near grey has little hue to keep, rounded to 8 bits
      if (before > 0.3 && after > 0.3) expect(Math.abs(hueOf(saturated) - hueOf(color))).toBeLessThan(3)
    }
  }
})

test('an amount of 0 leaves the step as it is; a grey takes the hue of the seed, or none', () => {
  expect(saturateStep('#ecedf0', 0, 8, WHITE, 'wcag3')).toBe('#ecedf0')
  // no hue to keep and none given: the grey stays grey
  expect(saturateStep('#a3a3a3', 60, 45, WHITE, 'wcag3')).toBe('#a3a3a3')
  const blue = hueOf('#00379E')
  const tinted = saturateStep('#a3a3a3', 60, 45, WHITE, 'wcag3', blue)
  expect(relativeSaturation(tinted)).toBeGreaterThan(0.5)
  expect(Math.abs(hueOf(tinted) - blue)).toBeLessThan(3)
})

const BRAND: MagmaConfig = {
  colors: [{ color: '#00379E', name: 'brand.maggioli', colorspace: 'HSL', smooth: true }],
}

function stepsOf(tokens: ReturnType<typeof createColorTokens>['tokens'], mode: 'light' | 'dark'): string[] {
  const palette = tokens.color.brand.maggioli[mode]
  return Object.keys(palette)
    .filter((key) => key !== 'color' && key !== 'seed')
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => palette[key].value)
}

test('a flat curve, global or of a colour, generates the exact same tokens', () => {
  const base = createColorTokens(BRAND).tokens
  expect(createColorTokens({ ...BRAND, saturation: { dark: 0, light: 0 } }).tokens).toEqual(base)
  expect(
    createColorTokens({ colors: [{ ...BRAND.colors[0], saturation: { dark: 0, light: 0, curve: 'hard' } }] })
      .tokens,
  ).toEqual(base)
})

test('the curve brings colour back to the pale end and keeps every target of the scale', () => {
  const base = createColorTokens(BRAND).tokens
  const curved = createColorTokens({ ...BRAND, saturation: { dark: 0, light: 60, curve: 'smooth' } }).tokens
  // the default scale of wcag3, in tokens from the most contrasted (1) to the least (10)
  const targets = [100, 92, 84, 74, 66, 45, 34, 23, 16, 8]
  for (const mode of ['light', 'dark'] as const) {
    const before = stepsOf(base, mode)
    const after = stepsOf(curved, mode)
    const background = mode === 'light' ? WHITE : BLACK
    after.forEach((step, i) => {
      // Leonardo itself may land a hair under a target; a saturated step never does
      if (step !== before[i]) expect(contrastOn(step, background, 'wcag3')).toBeGreaterThanOrEqual(targets[i])
    })
    // the order of the scale holds: every step more contrasted than the next one
    for (let i = 1; i < after.length; i++) {
      expect(contrastOn(after[i - 1], background, 'wcag3')).toBeGreaterThan(contrastOn(after[i], background, 'wcag3'))
    }
  }
  // the lightest step: token 10 in light mode, token 1 in dark mode; the darkest end is untouched
  expect(relativeSaturation(stepsOf(curved, 'light')[9])).toBeGreaterThan(relativeSaturation(stepsOf(base, 'light')[9]) + 0.3)
  expect(relativeSaturation(stepsOf(curved, 'dark')[0])).toBeGreaterThan(relativeSaturation(stepsOf(base, 'dark')[0]) + 0.3)
  expect(stepsOf(curved, 'light')[0]).toBe(stepsOf(base, 'light')[0])
  expect(stepsOf(curved, 'dark')[9]).toBe(stepsOf(base, 'dark')[9])
})

test('the saturation of a colour overrides the global one', () => {
  const base = createColorTokens(BRAND).tokens
  const global = { dark: -60, light: 60 }
  // the colour opts out with a flat curve of its own
  const optedOut = createColorTokens({
    saturation: global,
    colors: [{ ...BRAND.colors[0], saturation: { dark: 0, light: 0 } }],
  }).tokens
  expect(optedOut).toEqual(base)
  // without its own, the colour takes the global one
  const inherited = createColorTokens({ ...BRAND, saturation: global }).tokens
  expect(stepsOf(inherited, 'light')).not.toEqual(stepsOf(base, 'light'))
  expect(relativeSaturation(stepsOf(inherited, 'light')[0])).toBeLessThan(relativeSaturation(stepsOf(base, 'light')[0]))
})

test('the schema accepts a saturation curve, global and per colour, within -100..100', () => {
  const config = {
    saturation: { dark: 40, light: -20, curve: { deadZone: 0.2, easing: 'quad-in' } },
    colors: [{ color: '#00379E', name: 'brand.maggioli', saturation: { light: 60, curve: 'hard' } }],
  }
  expect(validateConfig(config).valid).toBe(true)
  expect(validateConfig({ ...config, saturation: { dark: 120 } }).valid).toBe(false)
  expect(validateConfig({ ...config, saturation: { tone: 10 } }).valid).toBe(false)
})
