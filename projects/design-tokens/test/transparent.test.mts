// The transparent backgrounds (#1472): the band and the track, the ink at an alpha times one
// intensity. What the layer declares where, and the calibration: the alphas were solved on the
// page of each mode for the distances decided on the board of the tracks (2026-11-20), and this
// file measures them again on the tree, so a retuned page or ink that moves them fails here.
import chroma from 'chroma-js'
import { describe, expect, test } from 'vitest'

import { getColorsConfig } from '../src/lib/utils.mjs'
import { createColorTokens, type MagmaConfig } from '../src/lib/color.mjs'
import { aliasesFromConfig, resolvePrimitive, type ColorTree } from '../src/lib/contrast-gate.js'
import { cssDecl, semantic, transparentMix } from '../semantic.config'
import { semanticModel } from '../semantic.model'

type Mode = 'light' | 'dark'

const loadTree = async (): Promise<ColorTree> => {
  const rc = await getColorsConfig()
  return (createColorTokens(rc!.config as MagmaConfig).tokens as { color: ColorTree }).color
}

describe('the layer', () => {
  const model = semanticModel()
  const base = model.base.flatMap(({ decls }) => decls)
  const byName = (name: string) => base.find((decl) => decl.name === name)

  test('the roles are mixes declared on every element, the alphas and the intensity values on :root', () => {
    expect(byName('magma-band')).toMatchObject({ everyElement: true, tw: 'band', value: transparentMix('band') })
    expect(byName('magma-track')).toMatchObject({ everyElement: true, tw: 'track', value: transparentMix('track') })
    expect(transparentMix('band')).toBe(
      'color-mix(in oklab, var(--magma-text-default) calc(var(--magma-band-alpha) * var(--magma-wash-intensity)), transparent)',
    )
    for (const name of ['magma-band-alpha', 'magma-track-alpha', 'magma-band-selected-alpha', 'magma-wash-intensity'])
      expect(byName(name)?.everyElement, name).toBeUndefined()
    expect(cssDecl(byName('magma-band-alpha')!)).toBe('  --magma-band-alpha: 4.51%;')
    expect(cssDecl(byName('magma-wash-intensity')!)).toBe('  --magma-wash-intensity: 1;')
  })

  test('the selected option is the white chip in light and an alpha over the band in dark', () => {
    expect(byName('magma-band-selected')).toMatchObject({ everyElement: true, ref: 'magma-surface-overlay' })
    expect(model.dark.find((decl) => decl.name === 'magma-band-selected')).toMatchObject({
      everyElement: true,
      value: transparentMix('band-selected'),
    })
    // read in dark only, so declared once with that value
    expect(byName('magma-band-selected-alpha')?.value).toBe('8.82%')
  })

  test('dark changes the alphas that differ, on :root', () => {
    const dark = Object.fromEntries(
      model.dark.filter((decl) => decl.name.endsWith('-alpha')).map((decl) => [decl.name, decl]),
    )
    expect(dark['magma-band-alpha']).toEqual({ name: 'magma-band-alpha', value: '3.33%' })
    expect(dark['magma-track-alpha']).toEqual({ name: 'magma-track-alpha', value: '8.04%' })
    expect(dark['magma-band-selected-alpha']).toBeUndefined()
  })

  test('every role, alpha and the intensity says what it is for', () => {
    for (const name of ['magma-band', 'magma-band-selected', 'magma-track', 'magma-band-alpha', 'magma-track-alpha', 'magma-band-selected-alpha', 'magma-wash-intensity'])
      expect(byName(name)?.description, name).toMatch(/\.$/)
  })
})

describe('the calibration', () => {
  // OKLab L x 100 from sRGB 0-255, Ottosson's reference matrices, as the board measured the
  // distances (chroma-js has its own OKLab, 0.2 L apart on these greys)
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const L = (color: chroma.Color) => {
    const [r, g, b] = color.rgb(false).map(lin)
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return (0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s) * 100
  }
  // the ink at alpha a over a colour, as the browser composites it, unrounded
  const lay = (ink: string, alpha: number, under: chroma.Color) => chroma.mix(under, ink, alpha, 'rgb')
  const DISTANCE = { band: 3.3, track: 7.3, selected: 10.6 }
  // The board solved the alphas reading the mix back through an 8-bit canvas, which quantizes
  // the alpha to 1/255 (3.33% reads 8/255): the composite in floats lands up to 0.22 L off the
  // decided distance (the dark band, 3.08). A third of a point is one 8-bit step on these greys;
  // a retuned page or ink moves the band by more than that.
  const TOLERANCE = 0.35

  for (const mode of ['light', 'dark'] as Mode[])
    test(`band, track and the selected option sit at their distance from the page in ${mode}`, async () => {
      const tree = await loadTree()
      const aliases = aliasesFromConfig(semantic)
      const hex = (role: string) => {
        const alias = aliases[`--magma-${role}`]
        return resolvePrimitive(tree, typeof alias === 'string' ? alias : alias[mode], mode)
      }
      const page = chroma(hex('surface-default'))
      const ink = hex(semantic.transparent.ink)
      const { roles } = semantic.transparent
      // toward the ink: below the page in light, above it in dark
      const sign = mode === 'light' ? -1 : 1
      const band = lay(ink, roles.band.alpha[mode]! / 100, page)
      expect(Math.abs(sign * (L(band) - L(page)) - DISTANCE.band)).toBeLessThan(TOLERANCE)
      const track = lay(ink, roles.track.alpha[mode]! / 100, page)
      expect(Math.abs(sign * (L(track) - L(page)) - DISTANCE.track)).toBeLessThan(TOLERANCE)
      if (mode === 'dark') {
        const selected = lay(ink, roles['band-selected'].alpha.dark! / 100, band)
        expect(Math.abs(L(selected) - L(page) - DISTANCE.selected)).toBeLessThan(TOLERANCE)
      }
    })
})
