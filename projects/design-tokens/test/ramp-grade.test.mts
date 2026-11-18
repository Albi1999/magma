import { expect, test } from 'vitest'

import { createColorTokens, MagmaConfig } from '../src/lib/color.mjs'
import { gradeRamps, measureRamp } from '../src/lib/ramp-grade.mjs'
import { COLORSPACES, validateConfig } from '../src/lib/schema.mjs'

// the two ramps (light, dark) of one colour, as the engine builds them
function rampsOf (color: string, colorspace: string, smooth = false): string[][] {
  const config: MagmaConfig = {
    colors: [{ color: color as `#${string}`, name: 'probe.color', colorspace: colorspace as never, smooth }],
  }
  const { tokens } = createColorTokens(config)
  return (['light', 'dark'] as const).map((mode) => {
    const palette = tokens.color.probe.color[mode]
    return Object.keys(palette)
      .filter((key) => key !== 'color' && key !== 'seed')
      .map((key) => palette[key].value)
  })
}

const verdictOf = (color: string, colorspace: string, smooth = false) =>
  gradeRamps(rampsOf(color, colorspace, smooth).map((ramp) => measureRamp(ramp, color)))

test('a colorspace that holds the seed passes', () => {
  // HSL keeps violet violet and saturated; OKLAB keeps yellow yellow
  expect(verdictOf('#8b5cf6', 'HSL').grade).toBe('ok')
  expect(verdictOf('#eab308', 'OKLAB').grade).toBe('ok')
})

test('a hue that changes family fails, and says on which side', () => {
  // OKLCH turns the dark steps of yellow toward orange
  const yellow = verdictOf('#eab308', 'OKLCH')
  expect(yellow.grade).toBe('error')
  expect(yellow.hue).toMatchObject({ grade: 'error', side: 'dark' })
  expect(yellow.hue!.degrees).toBeGreaterThan(25)
  // LCH turns blue toward purple
  expect(verdictOf('#00379E', 'LCH').hue!.grade).toBe('error')
})

test('a ramp that goes grey fails on its saturation', () => {
  // smooth HSL greys the light steps of the Maggioli blue out
  const smooth = verdictOf('#00379E', 'HSL', true)
  expect(smooth.grade).toBe('error')
  expect(smooth.saturation).toMatchObject({ grade: 'error', side: 'light' })
  // HSV greys the dark steps of violet out
  expect(verdictOf('#8b5cf6', 'HSV').saturation).toMatchObject({ grade: 'error', side: 'dark' })
  // OKLCH leaves the light steps of the green of success at a third of its saturation: a look
  expect(verdictOf('#21BF73', 'OKLCH').saturation!.grade).toBe('warning')
})

test('a grey seed has no hue nor saturation to lose', () => {
  const grey = verdictOf('#a3a3a3', 'HSL')
  expect(grey).toEqual({ grade: 'ok', hue: null, saturation: null })
})

test('the worst ramp of the family sets the grade', () => {
  const light = { hueTurn: { degrees: 4, side: 'light' as const }, saturationKept: { share: 0.9, side: 'light' as const } }
  const dark = { hueTurn: { degrees: 18, side: 'dark' as const }, saturationKept: { share: 0.2, side: 'dark' as const } }
  const verdict = gradeRamps([light, dark])
  expect(verdict.grade).toBe('error')
  expect(verdict.hue).toEqual({ grade: 'warning', degrees: 18, side: 'dark' })
  expect(verdict.saturation).toEqual({ grade: 'error', share: 0.2, side: 'dark' })
})

test('every colorspace of the schema builds a ramp; the ones the engine cannot build are gone', () => {
  for (const colorspace of COLORSPACES) {
    expect(() => rampsOf('#8b5cf6', colorspace)).not.toThrow()
  }
  for (const colorspace of ['CAM02', 'CAM02p', 'HSLuv']) {
    expect(validateConfig({ colors: [{ color: '#8b5cf6', name: 'probe.color', colorspace }] }).valid).toBe(false)
  }
})
