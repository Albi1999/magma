import chroma from "chroma-js";
import {
  contrast,
  type ContrastColor,
  type ContrastFormula,
  type RgbHexColor,
} from "./leonardo/index.js";
import { resolveCurveWeights, type HueShiftCurve, type ThemeMode } from "./hue-shift.mjs";

/*
  The saturation curve of a scale (#1439, vittorio 2026-11-18). Leonardo builds a scale from white
  through the seed to black, so the steps far from the seed lose their colour where the family is
  interpolated in OKLCH or in a smooth HSL (the lightest step of brand.maggioli sits at 16% of the
  most vivid blue sRGB holds there). The curve raises or lowers the saturation of each step after
  Leonardo, toward the two ends of the scale, as the hue shift turns its hue:

  - the measure is the relative saturation in OKLCH: the chroma of the step over the largest chroma
    sRGB holds at its lightness and hue (0 grey, 1 the most vivid). A step never leaves sRGB and
    keeps its OKLCH hue. HSL saturation is not the measure: the HSL families already keep 93% of it
    on every step, and their lightest steps still look pale;
  - an amount from -100 to 100: a positive one closes that share of the distance to the most vivid
    colour, a negative one takes that share of the saturation away, toward grey. 0 leaves the step
    as Leonardo made it, so a curve with both ends at 0 is flat and the scale is the one of today;
  - the amounts across the scale come from the curves of the hue shift (resolveCurveWeights), at
    full weight on the physically darkest and lightest steps, in both modes;
  - the contrast stays the one of the scale: the chroma moves the luminance, so the lightness of
    each saturated step is solved again for the target of its step, never below it.

  A flat target (every step at the saturation of the seed) was tried and dropped: near the cusp of
  green and yellow it gives fluorescent light steps (#1439).
*/

export interface SaturationConfig {
  /**
   * Change of the relative saturation, from -100 (grey) to 100 (the most vivid colour sRGB holds),
   * at full weight on the physically darkest steps of the scale, regardless of theme mode.
   */
  dark?: number;
  /** The same on the physically lightest steps of the scale. */
  light?: number;
  /** Intensity curve across the scale, the curves of the hue shift. Defaults to "smooth". */
  curve?: HueShiftCurve;
}

const MAX_AMOUNT = 100;

// under this OKLCH chroma a step is grey: its hue is noise, the hue of the seed stands for it
const ACHROMATIC = 0.002;

// iterations of the two bisections: 2^-24 of the range is far below one 8-bit step
const ITERATIONS = 24;

// how far out of [0, 1] a linear channel may fall and still count as inside sRGB: the noise of the
// floating point at the faces of the gamut
const GAMUT_EPSILON = 1e-7;

// the lightness step that brings a rounded step back over its target (see saturateStep)
const NUDGE = 0.0005;

function checkedAmount(amount: number, side: string): number {
  if (typeof amount !== "number" || Number.isNaN(amount) || Math.abs(amount) > MAX_AMOUNT) {
    throw new Error(
      `saturation ${side} must be a number in the [-${MAX_AMOUNT}, ${MAX_AMOUNT}] range, got ${amount}`,
    );
  }
  return amount;
}

/** True when the curve changes some step: an end other than 0. */
export function hasSaturation(config?: SaturationConfig): boolean {
  if (!config) return false;
  return (config.dark ?? 0) !== 0 || (config.light ?? 0) !== 0;
}

/**
 * The amount (-100..100) of every step of a scale, in the order of its ratios (from the background
 * outward). As the hue shift, the dark and light ends are anchored to the physical lightness of the
 * steps: in light mode the steps near the background are the light ones, in dark mode the dark ones.
 */
export function resolveStepSaturation(
  config: SaturationConfig,
  steps: number,
  mode: ThemeMode,
): number[] {
  const weights = resolveCurveWeights(config.curve ?? "smooth", steps, "saturation");
  const dark = checkedAmount(config.dark ?? 0, "dark");
  const light = checkedAmount(config.light ?? 0, "light");
  const nearBackground = mode === "light" ? light : dark;
  const farFromBackground = mode === "light" ? dark : light;
  return weights.map((weight, i) => {
    const amount = i < steps / 2 ? nearBackground : farFromBackground;
    // never -0: a step with no weight is plainly unchanged
    return (amount * weight) / 100 || 0;
  });
}

/*
  OKLCH to sRGB by hand, the matrices of OKLab (Ottosson, https://bottosson.github.io/posts/oklab/,
  the ones of chroma-js and of CSS Color 4): the two bisections convert thousands of candidates per
  scale, and an object of chroma-js for each made a global curve six times slower than the scales
  themselves (334 ms against 57 ms on the configuration of Magma).
*/
type Rgb = [number, number, number];

function linearRgbOf(lightness: number, chromaValue: number, hue: number): Rgb {
  const radians = (hue * Math.PI) / 180;
  const a = chromaValue * Math.cos(radians);
  const b = chromaValue * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const insideGamut = (rgb: Rgb) =>
  rgb.every((channel) => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON);

// a linear channel to its 8-bit value, unrounded (the sRGB transfer function), clamped to sRGB
function encoded(channel: number): number {
  const clamped = Math.min(1, Math.max(0, channel));
  const gamma =
    clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return gamma * 255;
}

const hexOf = (rgb: Rgb): RgbHexColor =>
  `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;

/** The largest OKLCH chroma sRGB holds at a lightness and a hue. */
export function maxChroma(lightness: number, hue: number): number {
  let inside = 0;
  let outside = 0.5;
  for (let i = 0; i < ITERATIONS; i++) {
    const middle = (inside + outside) / 2;
    if (insideGamut(linearRgbOf(lightness, middle, hue))) inside = middle;
    else outside = middle;
  }
  return inside;
}

/** The relative saturation of a colour (0..1): its OKLCH chroma over the largest sRGB holds there. */
export function relativeSaturation(color: string): number {
  const [lightness, chromaValue, hue] = chroma(color).oklch();
  if (Number.isNaN(hue) || chromaValue < ACHROMATIC) return 0;
  const max = maxChroma(lightness, hue);
  return max > 0 ? Math.min(chromaValue / max, 1) : 0;
}

/** A relative saturation moved by an amount (-100..100): toward the most vivid, or toward grey. */
export function shiftSaturation(relative: number, amount: number): number {
  const share = amount / MAX_AMOUNT;
  return share >= 0 ? relative + (1 - relative) * share : relative * (1 + share);
}

/**
 * A step with its relative saturation moved by `amount`, at the same OKLCH hue, its lightness
 * solved again so that its contrast against `background` is at least `target` (the formula of its
 * scale). A grey step takes `fallbackHue` (the hue of the seed); with none it stays as it is.
 */
export function saturateStep(
  color: RgbHexColor,
  amount: number,
  target: number,
  background: string,
  formula: ContrastFormula,
  fallbackHue = Number.NaN,
): RgbHexColor {
  if (amount === 0) return color;
  const [, chromaValue, ownHue] = chroma(color).oklch();
  const grey = Number.isNaN(ownHue) || chromaValue < ACHROMATIC;
  const hue = grey ? fallbackHue : ownHue;
  if (Number.isNaN(hue)) return color;
  const relative = shiftSaturation(grey ? 0 : relativeSaturation(color), amount);

  const base = chroma(background).rgb();
  const baseV = undefined;
  const contrastOf = (rgb: Rgb) => Math.abs(contrast(rgb, base, baseV, formula));
  // the candidate at a lightness, its 8-bit channels unrounded
  const at = (lightness: number): Rgb =>
    linearRgbOf(lightness, relative * maxChroma(lightness, hue), hue).map(encoded) as Rgb;
  const rounded = (rgb: Rgb): Rgb => rgb.map(Math.round) as Rgb;
  // on a light background the contrast grows as the lightness falls, on a dark one as it rises;
  // `strong` always holds the target (black and white hold every target a scale reaches)
  const lightBackground = chroma(background).luminance() > 0.5;
  let weak = lightBackground ? 1 : 0;
  let strong = lightBackground ? 0 : 1;
  for (let i = 0; i < ITERATIONS; i++) {
    const middle = (weak + strong) / 2;
    if (contrastOf(at(middle)) >= target) strong = middle;
    else weak = middle;
  }
  // the rounding to 8 bits can still take a hair of contrast away: a step toward the strong end
  let lightness = strong;
  let result = rounded(at(lightness));
  while (contrastOf(result) < target && lightness > 0 && lightness < 1) {
    lightness = Math.min(1, Math.max(0, lightness + (lightBackground ? -NUDGE : NUDGE)));
    result = rounded(at(lightness));
  }
  return hexOf(result);
}

/**
 * The scale of a colour with its saturation moved, step by step (`amounts` in the order of its
 * values, see resolveStepSaturation). Each step keeps the target contrast Leonardo solved it for.
 */
export function saturateContrastColor(
  color: ContrastColor,
  amounts: number[],
  background: string,
  formula: ContrastFormula,
  seed: RgbHexColor,
): ContrastColor {
  const seedHue = chroma(seed).oklch()[2];
  return {
    ...color,
    values: color.values.map((step, i) => ({
      ...step,
      value: saturateStep(
        step.value as RgbHexColor,
        amounts[i] ?? 0,
        Math.abs(step.contrast),
        background,
        formula,
        seedHue,
      ),
    })),
  };
}
