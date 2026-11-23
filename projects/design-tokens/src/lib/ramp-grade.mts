import chroma from "chroma-js";
import { maxChroma, relativeSaturation } from "./saturation.mjs";

/*
  How a ramp holds its seed (#1454, vittorio 2026-11-18): the colorspace a family is interpolated in
  decides whether the steps keep the hue and the saturation of the seed, and the right one depends
  on the colour (OKLCH holds violet and red, and turns yellow by 39 degrees; LCH and LAB turn blue
  and violet toward purple; HSL with smooth greys the light steps out). So the studio grades the
  choice of each family on its own ramp, not on a fixed ranking of the colorspaces.

  Two measures, both against the seed, on the ramp as the colorspace and smooth build it (the hue
  shift and the saturation curve, set on purpose, left out by the caller):

  - the hue turn: the largest OKLCH hue difference between a step and the seed, on the steps with
    a hue to read (OKLCH chroma of at least 0.03: under it the hue of a near grey is noise);
  - the saturation kept: the smallest relative saturation of a step (saturation.mts) over the one of
    the seed, on the steps where sRGB holds some chroma (at least 0.02: next to black and white
    there is no room for colour, and any ramp goes grey there). A grey seed keeps nothing to lose.

  The thresholds are starting points, tuned on the ramps of Magma on 2026-11-18, to be revised in
  the studio: a hue turn of up to 12 degrees passes (HSL holds label.violet at 11, and its ramp
  reads violet), up to 25 asks for a look (LAB on violet, 14), beyond it the hue changes family
  (LCH and LAB turn blue to purple by 28); a step keeping at least 60% of the saturation of the
  seed passes, at least 30% asks for a look (OKLCH greys status.success to 34%), under it the ramp
  goes grey (HSL with smooth leaves brand.maggioli at 16%, HSV the darks of violet at 10%).
*/

export type RampSide = "dark" | "light";
export type RampGrade = "ok" | "warning" | "error";

export interface RampMeasure {
  /** The largest hue difference from the seed, in OKLCH degrees, and the side of that step. */
  hueTurn: { degrees: number; side: RampSide } | null;
  /** The smallest share (0..1) of the saturation of the seed a step keeps, and its side. */
  saturationKept: { share: number; side: RampSide } | null;
}

/** Up to these degrees of hue turn a ramp passes, then it asks for a look, then it fails. */
export const HUE_TURN_LIMITS = { ok: 12, warning: 25 } as const;
/** From these shares of the saturation of the seed a ramp passes, then asks for a look. */
export const SATURATION_KEPT_LIMITS = { ok: 0.6, warning: 0.3 } as const;

// under this OKLCH chroma the hue of a step is noise
const HUE_READABLE = 0.03;
// where sRGB holds less than this chroma there is no room for colour, next to black and white
const ROOM_FOR_COLOUR = 0.02;
// a seed with less relative saturation is a grey: it keeps nothing to lose
const GREY_SEED = 0.05;

const hueDifference = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);

/** How the steps of a ramp hold the hue and the saturation of its seed. */
export function measureRamp(steps: string[], seed: string): RampMeasure {
  const [seedLightness, seedChroma, seedHue] = chroma(seed).oklch();
  const seedHasHue = !Number.isNaN(seedHue) && seedChroma >= HUE_READABLE;
  const seedSaturation = relativeSaturation(seed);
  let hueTurn: RampMeasure["hueTurn"] = null;
  let saturationKept: RampMeasure["saturationKept"] = null;
  for (const step of steps) {
    const [lightness, chromaValue, hue] = chroma(step).oklch();
    const side: RampSide = lightness < seedLightness ? "dark" : "light";
    if (seedHasHue && !Number.isNaN(hue) && chromaValue >= HUE_READABLE) {
      const degrees = hueDifference(hue, seedHue);
      if (hueTurn === null || degrees > hueTurn.degrees) hueTurn = { degrees, side };
    }
    if (seedSaturation >= GREY_SEED) {
      const room = Number.isNaN(hue) ? maxChroma(lightness, seedHue) : maxChroma(lightness, hue);
      if (room < ROOM_FOR_COLOUR) continue;
      const share = Math.min(relativeSaturation(step) / seedSaturation, 1);
      if (saturationKept === null || share < saturationKept.share)
        saturationKept = { share, side };
    }
  }
  return { hueTurn, saturationKept };
}

const gradeOf = (value: number, limits: { ok: number; warning: number }, higherIsBetter: boolean) => {
  if (higherIsBetter) return value >= limits.ok ? "ok" : value >= limits.warning ? "warning" : "error";
  return value <= limits.ok ? "ok" : value <= limits.warning ? "warning" : "error";
};

const RANK: Record<RampGrade, number> = { ok: 0, warning: 1, error: 2 };

export interface RampVerdict {
  grade: RampGrade;
  /** The grade of the hue turn and of the saturation kept, the worst of the ramps measured. */
  hue: { grade: RampGrade; degrees: number; side: RampSide } | null;
  saturation: { grade: RampGrade; share: number; side: RampSide } | null;
}

/** The grade of one or more ramps of a family (light and dark mode): the worst of each measure. */
export function gradeRamps(measures: RampMeasure[]): RampVerdict {
  let hue: RampVerdict["hue"] = null;
  let saturation: RampVerdict["saturation"] = null;
  for (const { hueTurn, saturationKept } of measures) {
    if (hueTurn && (hue === null || hueTurn.degrees > hue.degrees))
      hue = { ...hueTurn, grade: gradeOf(hueTurn.degrees, HUE_TURN_LIMITS, false) };
    if (saturationKept && (saturation === null || saturationKept.share < saturation.share))
      saturation = {
        ...saturationKept,
        grade: gradeOf(saturationKept.share, SATURATION_KEPT_LIMITS, true),
      };
  }
  const grade = [hue?.grade ?? "ok", saturation?.grade ?? "ok"].reduce((worst, one) =>
    RANK[one] > RANK[worst] ? one : worst,
  ) as RampGrade;
  return { grade, hue, saturation };
}
