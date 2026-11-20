/**
 * APCA contrast gate (issue #575, A3).
 *
 * Verifies that the semantic color pairs defined in the S0 spec meet their
 * contrast targets in BOTH modes, so a regression fails CI instead of shipping.
 * GitHub runs the equivalent APCA check on every Primer PR.
 *
 * Data source: the in-memory token model (`createColorTokens(config).tokens.color`),
 * NOT the generated `dist/css` (which can be stale relative to the source config).
 * The `--magma-*` -> primitive mapping is derived from `semantic.config.ts`
 * (the A9 contract) via `aliasesFromConfig`, so when a role is repointed to a
 * different step or family the gate re-verifies it automatically.
 *
 * Split by essentiality, matching spec section 9.1 / 9.2:
 *  - ENFORCED (severity `error`, fails the build): text-on-surface and
 *    on-emphasis pairs, against the explicit APCA Lc floors in the spec table.
 *  - REPORT-ONLY (`warn`/`info`, never fails): hue-fg (no numeric target in the
 *    spec) and borders (the spec de-emphasizes border contrast; decorative
 *    borders have no 3:1 floor). Surfaced so they can be tuned, not gated.
 *
 * Contrast bounds live in `contrast-range.ts` (A5, issue #578); the enforced
 * floors here are the per-role targets from section 9.1.
 */
import { APCAcontrast, sRGBtoY } from 'apca-w3';
import chroma from 'chroma-js';
// which text roles each wash level must carry (spec 9.1): one table for the gate, the semantic
// layer and the text-role engine, which solves the text against it (#1414)
import { WASH_TEXT_ENFORCED } from './wash.js';

export type Mode = 'light' | 'dark';
export type Severity = 'error' | 'warn' | 'info';
export type Metric = 'apca' | 'wcag2';
export type Category =
  | 'text-on-surface'
  | 'text-on-wash'
  | 'text-on-hue'
  | 'on-emphasis'
  | 'hue-fg'
  | 'border'
  | 'field'
  | 'text-on-band'
  | 'transparent';

/**
 * What a `--magma-*` role resolves to: one primitive in both modes, or one per
 * mode when the layer states the role differently in dark (the fill ink, #739).
 */
export type Alias = string | Record<Mode, string>;
export type AliasMap = Record<string, Alias>;

/** Shape of `createColorTokens(config).tokens.color`: color[group][name][mode][step] = { value }. */
export type ColorTree = Record<
  string,
  Record<string, Record<Mode, Record<string, { value: string }>>>
>;

/**
 * Enforced/target floors. Configurable so a consumer (or a future theme) can
 * override; the defaults are the spec section 9.1 values.
 */
export interface GateTargets {
  /** APCA Lc floor per text role (essential text cannot drop below its floor). */
  text: Record<'default' | 'muted' | 'subtle' | 'disabled', number>;
  /**
   * APCA Lc floor for text on a solid emphasis fill, per mode. Dark is lower
   * because the ink is the canvas, not pure black (spec 9.1, #739).
   */
  onEmphasis: Record<Mode, number>;
  /** APCA Lc target for colored fg on a surface (report-only; spec gives no number). */
  hueFg: number;
  /** WCAG2 non-text ratio for state borders (report-only; WCAG 1.4.11). */
  borderState: number;
  /**
   * WCAG2 non-text ratio for the roles of the frame of a form field on every surface
   * (enforced; WCAG 1.4.11: the edge is what shows where to type, #1438, #1466).
   */
  field: number;
}

export const DEFAULT_TARGETS: GateTargets = {
  text: { default: 75, muted: 75, subtle: 45, disabled: 30 },
  onEmphasis: { light: 75, dark: 70 },
  hueFg: 60,
  borderState: 3,
  field: 3,
};

const MODES: Mode[] = ['light', 'dark'];
const SURFACES = ['sunken', 'muted', 'default', 'raised', 'overlay'] as const;
const ELEVATED = ['default', 'raised'] as const;
// The two fixed accents (spec 8) plus the colored/neutral hues. Accents are a
// fixed set (semantic.config `accents`): the general `accent` (bare namespace, no
// infix) and `accent-ai`; their on-emphasis + fg pairs are gated like any other
// hue.
const HUES = ['accent', 'accent-ai', 'info', 'success', 'warning', 'danger', 'neutral'] as const;
const BORDERS = ['muted', 'default', 'strong', 'focus'] as const;
/**
 * The emphasis-band states a hue publishes, READ OFF the alias map instead of
 * listed here (spec 6.6): every `--magma-<hue>-emphasis-<state>` is a solid fill
 * that carries on-emphasis text, so a state added to the config is gated without
 * editing this file. The bare namespace never swallows an infixed one -
 * `accent-ai-emphasis-hover` does not start with `accent-emphasis-`. Surface-band
 * states (`surface-hover`/`-subtle`) add no new text-on-fill pair, and the
 * partial neutral publishes none at all.
 */
const emphasisStatesOf = (aliases: AliasMap, hue: string): string[] => {
  const prefix = `--magma-${hue}-emphasis-`;
  return Object.keys(aliases)
    .filter((token) => token.startsWith(prefix))
    .map((token) => token.slice(`--magma-${hue}-`.length));
};
/**
 * The ink and the fill of a hue's emphasis pair. The partial neutral's is the inverse surface
 * role (spec 6.4), `--magma-on-inverse` on `--magma-surface-inverse`, the names the layer
 * publishes since magma 3 dropped `neutral-emphasis` / `-on-emphasis` (#1334).
 */
const emphasisPairOf = (hue: string): [string, string] =>
  hue === 'neutral'
    ? ['--magma-on-inverse', '--magma-surface-inverse']
    : [`--magma-${hue}-on-emphasis`, `--magma-${hue}-emphasis`];
// The colored hues (every hue that is neither an accent nor the partial neutral):
// the ones that publish a text ladder on their own wash levels.
const TINTED_HUES = ['info', 'success', 'warning', 'danger'] as const;
// APCA is reported to <1 Lc precision; round display and compare on the rounded
// value so float noise never flips a verdict.
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Resolve a primitive var (e.g. `--tone-neutral-04`, `--surface-neutral-default`)
 * to its hex for a mode via the in-memory tree. Handles the step shapes:
 * named roles (surface/text/border), numeric steps (`04` -> tree key `4`), the
 * pure extreme of a SEEDED family (`--tone-*-seed` -> tree key `seed`), and the
 * bare base color of a non-seeded family (`--variant-primary` -> tree key `color`).
 */
export function resolvePrimitive(tree: ColorTree, varName: string, mode: Mode): string {
  const [group, name, ...rest] = varName.replace(/^--/, '').split('-');
  let step = rest.length ? rest.join('-') : 'color';
  if (/^\d+$/.test(step)) step = String(Number(step));
  const hex = tree?.[group]?.[name]?.[mode]?.[step]?.value;
  if (!hex) {
    throw new Error(
      `contrast-gate: cannot resolve ${varName} (${mode}) -> color.${group}.${name}.${mode}.${step}`,
    );
  }
  return hex;
}

/**
 * The slice of `semantic.config.ts` (the A9 contract) the gate needs.
 * Structurally typed so the lib stays generic - it takes any mapping, not the
 * concrete config; the CLI/test pass the real `semantic` object.
 */
export interface SemanticMapping {
  tint: string;
  surfaceRoles: readonly string[];
  borderRoles: readonly string[];
  textRoles: readonly string[];
  borderFocus: string;
  /**
   * The roles of the frame of a form field: field role -> the public role it aliases, both
   * without `magma-` (#1466); optional. Resolved off the map after every repoint, as the
   * `var()` chain resolves in CSS, so a promoted target carries the field role with it.
   */
  fieldRoles?: Record<string, string>;
  /**
   * The transparent backgrounds (#1472): the ink they mix, the wash intensity, and each role's
   * alpha per mode in percent (a mode without an alpha takes the `opaque` role); optional.
   */
  transparent?: {
    ink: string;
    intensity: number;
    roles: Record<string, { alpha: Partial<Record<Mode, number>>; opaque?: string }>;
  };
  seed: string;
  /** Surface role the fill ink takes in dark instead of the seed (spec 6.5); optional. */
  onEmphasisDark?: string;
  hues: Record<string, { family: string; roles?: string; partial?: boolean }>;
  hueSteps: { surface: string; fg: string; border: string; emphasis: string };
  accentSteps?: Partial<{ surface: string; fg: string; border: string; emphasis: string }>;
  neutralHueSteps: { fg: string; border: string; emphasis: string; emphasisMuted?: string };
  accents: Record<string, string>;
  /**
   * Solid-fill interaction-state steps (spec 6.6); optional. The `emphasis-*`
   * entries apply to the accents AND to the colored hues, the `surface-*` ones to
   * the accents only - see `emphasisStateSteps()` in semantic.config.
   */
  accentStateSteps?: Record<string, string>;
  /**
   * Wash levels, level -> ramp step: the neutral band (`--magma-wash-*`, spec
   * 6.1b, on the tint ramp) and every colored hue (`--magma-<hue>-wash-*`, spec
   * 6.4, on its own family). One map for both, so they cannot drift; optional.
   */
  washSteps?: Record<string, string>;
  /** Which published role each legacy quintet alias shortcuts to; optional. */
  hueRoles?: { surface: string; text: string; border: string };
  /** Ramp step the shadow ink names in light; in dark it is the seed (spec 6.1c); optional. */
  shadowStep?: string;
  /**
   * Ramp family behind `--magma-tint-scale-*`, when it is not the tint's own tone
   * scale. Mirrors `scaleFamily()` in semantic.config, which the gate cannot
   * import: this type is deliberately the SLICE of the contract the gate needs,
   * not the config itself.
   */
  scale?: string;
}

/**
 * Build the `--magma-* -> primitive` map from the A9 semantic config, resolving
 * straight through the tint indirection to the concrete primitive the gate
 * verifies (surfaces/text/borders from the active tint family; hues per the
 * quintet steps). Mirrors what `scripts/semantic.ts` emits.
 */
export function aliasesFromConfig(m: SemanticMapping): AliasMap {
  const map = withDarkInk(baseAliases(m), m);
  // the shadow ink (spec 6.1c, #790): the ink extreme in light, the seed (pure
  // black) in dark, as the dark block of the layer repoints it
  const shadow = map['--magma-shadow-ink'];
  if (typeof shadow === 'string')
    map['--magma-shadow-ink'] = { light: shadow, dark: `--${m.seed}` };
  return withFieldRoles(map, m);
}

/**
 * The roles of the frame of a form field (#1466): each one is `var()` of another public role,
 * so it resolves to whatever its target resolves to in this map (base, dark ink, contrast
 * promotion). Applied last, after every repoint.
 */
function withFieldRoles(map: AliasMap, m: SemanticMapping): AliasMap {
  Object.entries(m.fieldRoles ?? {}).forEach(([role, target]) => {
    const alias = map[`--magma-${target}`];
    if (!alias)
      throw new Error(`contrast-gate: the field role "${role}" names --magma-${target}, no role`);
    map[`--magma-field-${role}`] = alias;
  });
  return map;
}

/**
 * The fill ink in dark (spec 6.5, #739): every `*-on-emphasis` and `on-inverse`
 * takes the seed in light and the `onEmphasisDark` surface in dark, read off the
 * map itself so a promoted surface (spec 9.3) carries the ink with it, exactly as
 * the var() chain does in CSS.
 */
function withDarkInk(map: Record<string, string>, m: SemanticMapping): AliasMap {
  const out: AliasMap = { ...map };
  if (!m.onEmphasisDark) return out;
  const dark = map[`--magma-surface-${m.onEmphasisDark}`];
  if (!dark)
    throw new Error(`contrast-gate: onEmphasisDark "${m.onEmphasisDark}" is not a surface role`);
  Object.keys(map)
    .filter((token) => token.endsWith('on-emphasis') || token === '--magma-on-inverse')
    .forEach((token) => (out[token] = { light: map[token], dark }));
  return out;
}

/** The mode-independent map, before the dark ink is applied. */
function baseAliases(m: SemanticMapping): Record<string, string> {
  const map: Record<string, string> = {};
  const set = (magma: string, primitive: string) => (map[`--magma-${magma}`] = `--${primitive}`);

  m.surfaceRoles.forEach((r) => set(`surface-${r}`, `surface-${m.tint}-${r}`));
  m.textRoles.forEach((r) => set(`text-${r}`, `text-${m.tint}-${r}`));
  set('text-on-emphasis', m.seed);
  m.borderRoles.forEach((r) => set(`border-${r}`, `border-${m.tint}-${r}`));
  // focus follows the accent named by borderFocus, at its emphasis step
  set('border-focus', `${m.accents[m.borderFocus]}-${m.hueSteps.emphasis}`);
  // the neutral wash band (spec 6.1b): named steps of the ACTIVE TINT ramp, which
  // is what `scaleFamily(tint)` resolves to - not the surface band, which is
  // elevation and cannot hold these values in both modes.
  const rampFamily = m.scale ?? `tone-${m.tint}`; // = scaleFamily(tint) in semantic.config
  // the shadow ink (spec 6.1c): a colour, gated for resolution only - a shadow has
  // no text contrast floor of its own.
  if (m.shadowStep) set('shadow-ink', `${rampFamily}-${m.shadowStep}`);
  Object.entries(m.washSteps ?? {}).forEach(([level, step]) =>
    set(`wash-${level}`, `${rampFamily}-${step}`),
  );

  // A colored hue publishes the same vocabulary as the neutral scaffolding on its
  // own family: wash levels from named ramp steps, text + border from the family's
  // GENERATED role scales. The quintet aliases are shortcuts onto those roles, so
  // the gate resolves them to the same primitive the layer does. A `partial` hue
  // (neutral) still borrows ramp steps and publishes no ladder of its own.
  Object.entries(m.hues).forEach(([hue, { family, roles, partial }]) => {
    if (partial || !roles) {
      const steps = partial ? m.neutralHueSteps : m.hueSteps;
      // the neutral hue is the active tint's own ramp: the layer names it through
      // `--magma-tint-scale-*` so it retints with a named theme (#731), which for
      // the gate means the same `rampFamily` the wash band resolves to
      const source = partial ? rampFamily : family;
      if (!partial) set(`${hue}-surface`, `${family}-${m.hueSteps.surface}`);
      set(`${hue}-fg`, `${source}-${steps.fg}`);
      set(`${hue}-border`, `${source}-${steps.border}`);
      // the partial hue's emphasis pair is the inverse surface role (spec 6.4), under the names
      // the layer publishes: its old names neutral-emphasis / -on-emphasis went with magma 3
      set(partial ? 'surface-inverse' : `${hue}-emphasis`, `${source}-${steps.emphasis}`);
      set(partial ? 'on-inverse' : `${hue}-on-emphasis`, m.seed);
      // the inverse surface's less marked level (spec 6.1d): a fill that carries
      // on-inverse text, gated like an emphasis state
      if (partial && m.neutralHueSteps.emphasisMuted) {
        set('surface-inverse-muted', `${rampFamily}-${m.neutralHueSteps.emphasisMuted}`);
        set('on-inverse', m.seed);
      }
      return;
    }
    Object.entries(m.washSteps ?? {}).forEach(([level, step]) =>
      set(`${hue}-wash-${level}`, `${family}-${step}`),
    );
    m.textRoles.forEach((r) => set(`${hue}-text-${r}`, `text-${roles}-${r}`));
    m.borderRoles.forEach((r) => set(`${hue}-border-${r}`, `border-${roles}-${r}`));
    set(`${hue}-emphasis`, `${family}-${m.hueSteps.emphasis}`);
    // the emphasis band's interaction states, shared with the accents (spec 6.6).
    // Same predicate as `emphasisStateSteps()` in semantic.config: the surface-band
    // states are accent-only, a hue says that with wash levels.
    Object.entries(m.accentStateSteps ?? {})
      .filter(([state]) => state.startsWith('emphasis-'))
      .forEach(([state, step]) => set(`${hue}-${state}`, `${family}-${step}`));
    set(`${hue}-on-emphasis`, m.seed);
    const shortcut = m.hueRoles;
    if (shortcut) {
      set(`${hue}-surface`, `${family}-${(m.washSteps ?? {})[shortcut.surface]}`);
      set(`${hue}-fg`, `text-${roles}-${shortcut.text}`);
      set(`${hue}-border`, `border-${roles}-${shortcut.border}`);
    }
  });

  // accents (variant): the standout quintet, one per fixed role (spec 8). They
  // share the colored-hue steps (but for `accentSteps`) and resolve to the accent's mapped family. The
  // general `accent` role carries no infix (bare `--magma-accent-*`); others infix
  // their name - mirrors `accentInfix` in semantic.config and scripts/semantic.ts.
  const accentSteps = { ...m.hueSteps, ...m.accentSteps };
  Object.entries(m.accents).forEach(([role, family]) => {
    const infix = role === 'accent' ? '' : `${role}-`;
    set(`accent-${infix}surface`, `${family}-${accentSteps.surface}`);
    set(`accent-${infix}fg`, `${family}-${accentSteps.fg}`);
    set(`accent-${infix}border`, `${family}-${accentSteps.border}`);
    set(`accent-${infix}emphasis`, `${family}-${accentSteps.emphasis}`);
    set(`accent-${infix}on-emphasis`, m.seed);
    // interaction states (spec 6.6 accent exception): each names an existing ramp
    // step of the same family, mirroring scripts/semantic.ts.
    Object.entries(m.accentStateSteps ?? {}).forEach(([state, step]) =>
      set(`accent-${infix}${state}`, `${family}-${step}`),
    );
  });
  return map;
}

/** A contrast level's role promotions (role -> stronger same-family role). */
export type ContrastPromotions = {
  more?: {
    text?: Record<string, string>;
    border?: Record<string, string>;
    surface?: Record<string, string>;
    /** The wash intensity under the level (#1472). */
    intensity?: number;
  };
};

/**
 * The `--magma-* -> primitive` map UNDER a contrast level: start from the base
 * aliases and repoint the promoted text/border roles to their STRONGER same-family
 * step and the promoted surfaces to the family seed, mirroring what
 * `scripts/semantic.ts` emits for `:root.pref-contrast-<level>`. Everything else
 * the gate looks up (the other surfaces, hues, accents) stays at the base value,
 * so the returned map can be fed straight to `evaluatePairs`.
 */
export function contrastAliasesFromConfig(
  m: SemanticMapping & { contrast?: ContrastPromotions },
  level: keyof ContrastPromotions = 'more',
): AliasMap {
  const map = baseAliases(m);
  const promo = m.contrast?.[level];
  if (!promo) return withFieldRoles(withDarkInk(map, m), m);
  Object.entries(promo.text ?? {}).forEach(([role, stronger]) => {
    map[`--magma-text-${role}`] = `--text-${m.tint}-${stronger}`;
  });
  Object.entries(promo.border ?? {}).forEach(([role, stronger]) => {
    map[`--magma-border-${role}`] = `--border-${m.tint}-${stronger}`;
  });
  // the promoted surfaces take the family seed, so the gate measures the text
  // against the paper the page really shows under the level
  Object.entries(promo.surface ?? {}).forEach(([role, target]) => {
    map[`--magma-surface-${role}`] = `--tone-${m.tint}-${target}`;
  });
  // Every colored hue promotes its own roles off the same table (spec 9.3): the
  // layer states them as roles because a hue does not resolve through a tint
  // pointer. The quintet shortcuts are var() of these roles, so `<hue>-border`
  // follows `<hue>-border-default` here exactly as it does in CSS.
  Object.entries(m.hues).forEach(([hue, { roles, partial }]) => {
    if (partial || !roles) return;
    Object.entries(promo.text ?? {}).forEach(([role, stronger]) => {
      map[`--magma-${hue}-text-${role}`] = `--text-${roles}-${stronger}`;
    });
    Object.entries(promo.border ?? {}).forEach(([role, stronger]) => {
      map[`--magma-${hue}-border-${role}`] = `--border-${roles}-${stronger}`;
    });
    if (m.hueRoles?.text && promo.text?.[m.hueRoles.text]) {
      map[`--magma-${hue}-fg`] = `--text-${roles}-${promo.text[m.hueRoles.text]}`;
    }
    if (m.hueRoles?.border && promo.border?.[m.hueRoles.border]) {
      map[`--magma-${hue}-border`] = `--border-${roles}-${promo.border[m.hueRoles.border]}`;
    }
  });
  return withFieldRoles(withDarkInk(map, m), m);
}

const toY = (hex: string) => sRGBtoY(chroma(hex).rgb());
/** APCA Lc as a magnitude (Magma flips the sign in dark; the gate checks size). */
export const apcaLc = (fgHex: string, bgHex: string): number =>
  Math.abs(APCAcontrast(toY(fgHex), toY(bgHex)) as number);
export const wcag2Ratio = (aHex: string, bHex: string): number => chroma.contrast(aHex, bHex);

export interface PairResult {
  category: Category;
  /** Stable id for the baseline: `<fg>|<bg>|<mode>`, after `<theme>:` for a named theme. */
  key: string;
  fgToken: string;
  bgToken: string;
  fgHex: string;
  bgHex: string;
  mode: Mode;
  metric: Metric;
  achieved: number;
  target: number;
  pass: boolean;
  severity: Severity;
}

/**
 * Evaluate every semantic pair in both modes.
 * `aliases` is the `--magma-*` -> primitive map from `aliasesFromConfig`; `tree`
 * is `createColorTokens(config).tokens.color`.
 */
type Push = (
  category: Category,
  severity: Severity,
  metric: Metric,
  fg: string,
  bg: string,
  target: number,
  mode: Mode,
) => void;

/** A colour the gate measures: the role it stands for, as the report names it, and its hex. */
interface Painted {
  token: string;
  hex: string;
}

/** Records one pair of colours already resolved, the way `Push` records two roles. */
type PushPainted = (
  category: Category,
  severity: Severity,
  metric: Metric,
  fg: Painted,
  bg: Painted,
  target: number,
  mode: Mode,
) => void;

interface Recorder {
  push: Push;
  pushPainted: PushPainted;
  /** The hex a role resolves to in a mode, through the aliases. */
  resolveRole: (token: string, mode: Mode) => string;
}

/** What measures one pair on the tree, through the aliases, and records it in `out`. */
function recorder(tree: ColorTree, aliases: AliasMap, out: PairResult[]): Recorder {
  const short = (t: string) => t.replace(/^--magma-/, '');

  const resolveRole = (token: string, mode: Mode): string => {
    const alias = aliases[token];
    if (!alias) throw new Error(`contrast-gate: ${token} is not in the semantic config`);
    return resolvePrimitive(tree, typeof alias === 'string' ? alias : alias[mode], mode);
  };

  const pushPainted: PushPainted = (category, severity, metric, fg, bg, target, mode) => {
    const achieved = round1(
      metric === 'apca' ? apcaLc(fg.hex, bg.hex) : wcag2Ratio(fg.hex, bg.hex),
    );
    out.push({
      category,
      key: `${short(fg.token)}|${short(bg.token)}|${mode}`,
      fgToken: short(fg.token),
      bgToken: short(bg.token),
      fgHex: fg.hex,
      bgHex: bg.hex,
      mode,
      metric,
      achieved,
      target,
      pass: achieved >= target,
      severity,
    });
  };

  const push: Push = (category, severity, metric, fg, bg, target, mode) =>
    pushPainted(
      category,
      severity,
      metric,
      { token: fg, hex: resolveRole(fg, mode) },
      { token: bg, hex: resolveRole(bg, mode) },
      target,
      mode,
    );

  return { push, pushPainted, resolveRole };
}

/**
 * A colour at an alpha laid over another, as the browser draws a transparent role (#1472):
 * `color-mix(in oklab, ink p%, transparent)` is the ink itself at alpha p (the mix with
 * `transparent` takes no colour from it), and the browser composites it over what is beneath in
 * gamma-encoded sRGB, channel by channel.
 */
export const over = (inkHex: string, alpha: number, underHex: string): string =>
  chroma.mix(underHex, inkHex, alpha, 'rgb').hex();

/**
 * The surfaces a band or a track lies on (#1472): the well, the page, the card, and the overlay
 * (tabs in a modal, a progress in a dropdown). `muted` is a grouping inside a component, not the
 * ground of a component.
 */
export const TRANSPARENT_SURFACES = ['sunken', 'default', 'raised', 'overlay'] as const;

/**
 * The text roles a band carries (#1472): the labels of the unselected tabs and filters
 * (`text-muted`), the pages of the paginator (`text-default`), a disabled filter
 * (`text-disabled`), and `text-subtle` for a count or a hint. The band lies at the distance of
 * the soft wash, which carries the whole ladder (spec 9.1), and the band is held to the same.
 */
export const BAND_TEXT = ['default', 'muted', 'subtle', 'disabled'] as const;

/**
 * The text roles the band carries but the gate only REPORTS, by the surface it lies on (#1472,
 * decided by vittorio 2026-11-20). Over a well, in light, `text-muted` lands at 73.1 Lc on the band
 * (bisque 73.2, porcelain 73.5) against its floor of 75: the same bound as on `wash-base`, which
 * carries `text-default` only for that reason (spec 9.1). Holding it would take the band to 2.1
 * from the page instead of the decided 3.3, or the muted text one step of the ramp darker in the
 * whole system; the band keeps its weight, and the pair is measured and reported, at the
 * report-only target of the hues, every other role and surface enforced.
 */
export const BAND_TEXT_REPORTED: Partial<
  Record<(typeof TRANSPARENT_SURFACES)[number], readonly string[]>
> = { sunken: ['muted'] };

/**
 * The bands and the tracks over every surface they lie on, in one mode (#1472), and the text on
 * them: each text role of `BAND_TEXT` on the band at its floor (enforced, but for the pairs of
 * `BAND_TEXT_REPORTED`, reported), the label of the selected option on it, and the band and the track themselves against the surface, reported
 * with no floor (they carry no information on their own). `intensity` is the wash intensity in
 * play (the base one, or the one of a contrast level).
 */
function transparentPairs(
  rec: Recorder,
  m: SemanticMapping,
  targets: GateTargets,
  mode: Mode,
  intensity: number,
): void {
  const t = m.transparent;
  if (!t) return;
  const ink = rec.resolveRole(`--magma-${t.ink}`, mode);
  /** The role laid over `under`: its alpha in this mode, or its opaque role. */
  const lay = (role: string, under: string): string => {
    const { alpha, opaque } = t.roles[role];
    const a = alpha[mode];
    if (a !== undefined) return over(ink, Math.min(1, (a * intensity) / 100), under);
    if (!opaque)
      throw new Error(`contrast-gate: --magma-${role} has no alpha in ${mode} and no opaque role`);
    return rec.resolveRole(`--magma-${opaque}`, mode);
  };
  const role = (token: string): Painted => ({ token, hex: rec.resolveRole(token, mode) });
  // no floor: the band and the track are reported, so a theme sees where they land
  const report = (fg: Painted, bg: Painted) =>
    rec.pushPainted('transparent', 'info', 'wcag2', fg, bg, 1, mode);
  const text = (name: string, bg: Painted, reported = false) =>
    rec.pushPainted(
      'text-on-band',
      reported ? 'warn' : 'error',
      'apca',
      role(`--magma-text-${name}`),
      bg,
      reported ? targets.hueFg : targets.text[name as keyof GateTargets['text']],
      mode,
    );
  for (const surf of TRANSPARENT_SURFACES) {
    const surface = role(`--magma-surface-${surf}`);
    // `band@sunken`: the band laid over the well, the colour the eye sees there
    const at = (name: string, under: string): Painted => ({
      token: `--magma-${name}@${surf}`,
      hex: lay(name, under),
    });
    if (t.roles.track) report(at('track', surface.hex), surface);
    if (!t.roles.band) continue;
    const band = at('band', surface.hex);
    report(band, surface);
    for (const name of BAND_TEXT) text(name, band, BAND_TEXT_REPORTED[surf]?.includes(name));
    if (!t.roles['band-selected']) continue;
    // the selected option lies on the band: its label is the default text
    const selected = at('band-selected', band.hex);
    report(selected, band);
    text('default', selected);
  }
}

/**
 * The frame of a form field on every surface a field sits on (enforced, #1466): the edge at rest
 * is the only thing that shows where to type (#1438), the edge on hover and the required marker
 * are marks of their own. Read off the map, so a field role added to the config is gated without
 * editing this file.
 */
function fieldPairs(aliases: AliasMap, targets: GateTargets, push: Push, mode: Mode): void {
  for (const field of Object.keys(aliases).filter((t) => t.startsWith('--magma-field-'))) {
    for (const surf of SURFACES) {
      push('field', 'error', 'wcag2', field, `--magma-surface-${surf}`, targets.field, mode);
    }
  }
}

export function evaluatePairs(
  tree: ColorTree,
  aliases: AliasMap,
  targets: GateTargets = DEFAULT_TARGETS,
  mapping?: SemanticMapping,
): PairResult[] {
  const out: PairResult[] = [];
  const rec = recorder(tree, aliases, out);
  const { push } = rec;

  for (const mode of MODES) {
    // 1. every text role on every surface (enforced)
    for (const [role, target] of Object.entries(targets.text)) {
      for (const surf of SURFACES) {
        push(
          'text-on-surface',
          'error',
          'apca',
          `--magma-text-${role}`,
          `--magma-surface-${surf}`,
          target,
          mode,
        );
      }
    }
    // 2. every hue's on-emphasis text on its emphasis fill (enforced)
    for (const hue of HUES) {
      const [ink, fill] = emphasisPairOf(hue);
      push('on-emphasis', 'error', 'apca', ink, fill, targets.onEmphasis[mode], mode);
    }
    // 2b. hover/active fills carry on-emphasis text too (enforced), for accents and
    //     colored hues alike. They are more extreme than the base emphasis in the
    //     safe direction, so they pass by construction; gated for regression
    //     protection (e.g. a themed accent family, or a retuned ramp).
    for (const hue of HUES) {
      for (const state of emphasisStatesOf(aliases, hue)) {
        push(
          'on-emphasis',
          'error',
          'apca',
          `--magma-${hue}-on-emphasis`,
          `--magma-${hue}-${state}`,
          targets.onEmphasis[mode],
          mode,
        );
      }
    }
    // 2b'. the inverse surface's less marked level carries on-inverse text too
    //      (enforced): the weak dark variants and the hover of the strong one.
    if (aliases['--magma-surface-inverse-muted']) {
      push(
        'on-emphasis',
        'error',
        'apca',
        '--magma-on-inverse',
        '--magma-surface-inverse-muted',
        targets.onEmphasis[mode],
        mode,
      );
    }
    // 2c. every hue's text ladder on its OWN wash levels. This is the pair a
    //     banner, toast or badge actually renders, and the one that had no name in
    //     the contract before: previously the gate only checked colored ink on the
    //     NEUTRAL surfaces (section 3 below), which is a different question.
    //     Enforced per WASH_TEXT_ENFORCED; the rest is measured and reported.
    for (const hue of TINTED_HUES) {
      for (const [level, enforced] of Object.entries(WASH_TEXT_ENFORCED)) {
        for (const [role, floor] of Object.entries(targets.text)) {
          const gated = enforced.includes(role);
          push(
            'text-on-hue',
            gated ? 'error' : 'warn',
            'apca',
            `--magma-${hue}-text-${role}`,
            `--magma-${hue}-wash-${level}`,
            gated ? floor : targets.hueFg,
            mode,
          );
        }
      }
    }
    // 2d. the neutral text ladder on the NEUTRAL wash band (spec 6.1b). Same
    //     question as 2c one level down: a grey pill (a disabled switch track, a
    //     paginator hover, a zebra chip) is not an elevation surface, so section 1
    //     above never checked this pair. Enforced per WASH_TEXT_ENFORCED, the same
    //     table as the hues because the measurement came out the same.
    for (const [level, enforced] of Object.entries(WASH_TEXT_ENFORCED)) {
      for (const [role, floor] of Object.entries(targets.text)) {
        const gated = enforced.includes(role);
        push(
          'text-on-wash',
          gated ? 'error' : 'warn',
          'apca',
          `--magma-text-${role}`,
          `--magma-wash-${level}`,
          gated ? floor : targets.hueFg,
          mode,
        );
      }
    }
    // 3. colored fg on the elevated surfaces (report-only)
    for (const hue of HUES) {
      for (const surf of ELEVATED) {
        push(
          'hue-fg',
          'warn',
          'apca',
          `--magma-${hue}-fg`,
          `--magma-surface-${surf}`,
          targets.hueFg,
          mode,
        );
      }
    }
    // 4. borders vs the elevated surfaces (state = warn, decorative = info)
    for (const b of BORDERS) {
      const severity: Severity = b === 'strong' || b === 'focus' ? 'warn' : 'info';
      for (const surf of ELEVATED) {
        push(
          'border',
          severity,
          'wcag2',
          `--magma-border-${b}`,
          `--magma-surface-${surf}`,
          targets.borderState,
          mode,
        );
      }
    }
    // 5. the frame of a form field on every surface (enforced, #1466)
    fieldPairs(aliases, targets, push, mode);
    // 6. the bands and the tracks over the surfaces, and the text on the band (#1472)
    if (mapping?.transparent)
      transparentPairs(rec, mapping, targets, mode, mapping.transparent.intensity);
  }
  return out;
}

/**
 * The pairs of the frame of a form field under the contrast preference (#1466): the surfaces
 * and the roles the field roles alias are promoted (the page goes to the paper of the mode),
 * so the edge is measured again on what the page really shows then. Keyed `more:<key>`, after
 * `<theme>:` for a named theme, and marked in the surface column.
 */
export function evaluateFieldContrast(
  tree: ColorTree,
  m: SemanticMapping & { contrast?: ContrastPromotions },
  targets: GateTargets = DEFAULT_TARGETS,
  prefix = '',
): PairResult[] {
  const out: PairResult[] = [];
  const aliases = contrastAliasesFromConfig(m);
  const rec = recorder(tree, aliases, out);
  for (const mode of MODES) {
    fieldPairs(aliases, targets, rec.push, mode);
    // the band on the paper of the mode, at the intensity of the level (#1472)
    if (m.transparent)
      transparentPairs(
        rec,
        m,
        targets,
        mode,
        m.contrast?.more?.intensity ?? m.transparent.intensity,
      );
  }
  return out.map((r) => ({ ...r, key: `${prefix}more:${r.key}`, bgToken: `${r.bgToken} (more)` }));
}

/** A named theme as the config writes it: a surface family, or the object form. */
export type ThemeDefLike =
  string | { surface?: string; accents?: Record<string, string>; scale?: string };

/** A named theme the gate verifies on its own: its name and the mapping it resolves through. */
export interface ThemeMapping {
  name: string;
  mapping: SemanticMapping;
}

/**
 * The mapping of every named theme that repoints something (#692): the base mapping with the
 * three things a theme can repoint, its tint family, the ramp behind it and its accents. A
 * theme that repoints nothing IS the base layer, already verified, and has none. Mirrors
 * `themeOf` in semantic.model, which the gate cannot import (see `SemanticMapping`).
 */
export function themeMappingsFromConfig<M extends SemanticMapping>(
  m: M,
  themes: Record<string, ThemeDefLike>,
): Array<{ name: string; mapping: M }> {
  return Object.entries(themes).flatMap(([name, def]) => {
    const { surface, accents, scale } = typeof def === 'string' ? { surface: def } : def;
    const tint = surface ?? m.tint;
    if (tint === m.tint && !accents) return [];
    return [
      {
        name,
        mapping: {
          ...m,
          tint,
          // the ramp follows the family only when the theme retints it, as in themeOf
          scale: tint === m.tint ? m.scale : scale,
          accents: { ...m.accents, ...accents },
        },
      },
    ];
  });
}

/**
 * Every pair of one named theme, keyed `<theme>:<fg>|<bg>|<mode>`, so its baseline entries
 * never collide with the ones of the base layer.
 */
export function evaluateTheme(
  tree: ColorTree,
  { name, mapping }: ThemeMapping,
  targets: GateTargets = DEFAULT_TARGETS,
): PairResult[] {
  return evaluatePairs(tree, aliasesFromConfig(mapping), targets, mapping).map((r) => ({
    ...r,
    key: `${name}:${r.key}`,
  }));
}

/**
 * Every pair the gate measures on a token tree: the base layer, then each named theme that
 * repoints something, in its own family and accents (#692). The CLI (scripts/check-contrast.ts)
 * prints them and the studio (projects/studio) sums them up, so both judge the same pairs.
 */
export function gatePairs(
  tree: ColorTree,
  m: SemanticMapping & { contrast?: ContrastPromotions },
  themes: Record<string, ThemeDefLike>,
  targets: GateTargets = DEFAULT_TARGETS,
): { base: PairResult[]; themes: Array<{ name: string; results: PairResult[] }> } {
  // every pair in light, then every pair in dark, as evaluatePairs gives them
  const byMode = (results: PairResult[]): PairResult[] =>
    MODES.flatMap((mode) => results.filter((r) => r.mode === mode));
  // The contrast promotion takes the page to the seed of the tint's own tone ramp
  // (`contrastTintDecls`: `tone-<family>-seed`). A theme on a ramp of another group (a studio
  // theme on `label-blue`) has none, so its frame under the preference is not measured rather
  // than measured on a page the CSS does not draw; a scale naming the tone ramp itself is measured.
  const fieldContrast = (
    mapping: SemanticMapping & { contrast?: ContrastPromotions },
    prefix = '',
  ) =>
    (mapping.scale ?? `tone-${mapping.tint}`) === `tone-${mapping.tint}`
      ? evaluateFieldContrast(tree, mapping, targets, prefix)
      : [];
  return {
    base: byMode([...evaluatePairs(tree, aliasesFromConfig(m), targets, m), ...fieldContrast(m)]),
    themes: themeMappingsFromConfig(m, themes).map((theme) => ({
      name: theme.name,
      results: byMode([
        ...evaluateTheme(tree, theme, targets),
        ...fieldContrast(theme.mapping, `${theme.name}:`),
      ]),
    })),
  };
}

export interface BaselineEntry {
  achieved: number;
  target: number;
}
export type Baseline = Record<string, BaselineEntry>;

export interface GateOutcome {
  results: PairResult[];
  /** Enforced failures NOT covered by the baseline, or regressed below it: fail the build. */
  violations: PairResult[];
  /** Enforced failures accepted by the baseline (known offenders, to be tuned). */
  baselinedFailures: PairResult[];
  /** Baseline keys that no longer fail: the entry is stale and should be removed. */
  staleBaseline: string[];
}

// A baselined pair may not drop below its recorded value (float-noise tolerance only).
const REGRESSION_TOLERANCE = 0.05;

/**
 * Split enforced failures into accepted-by-baseline vs build-breaking. A pair is
 * accepted only if its key is baselined AND it has not regressed below the
 * recorded value, so a baselined offender getting worse still fails.
 */
export function applyBaseline(results: PairResult[], baseline: Baseline): GateOutcome {
  const enforcedFailures = results.filter((r) => r.severity === 'error' && !r.pass);
  const violations: PairResult[] = [];
  const baselinedFailures: PairResult[] = [];

  for (const r of enforcedFailures) {
    const b = baseline[r.key];
    if (b && r.achieved >= b.achieved - REGRESSION_TOLERANCE) baselinedFailures.push(r);
    else violations.push(r);
  }

  const failingKeys = new Set(enforcedFailures.map((r) => r.key));
  const staleBaseline = Object.keys(baseline).filter((k) => !failingKeys.has(k));

  return { results, violations, baselinedFailures, staleBaseline };
}

/** Build a baseline from the current enforced failures (for `--update-baseline`). */
export function buildBaseline(results: PairResult[]): Baseline {
  const baseline: Baseline = {};
  for (const r of results) {
    if (r.severity === 'error' && !r.pass)
      baseline[r.key] = { achieved: r.achieved, target: r.target };
  }
  return baseline;
}

// --- plain-text rendering (no color, so it is portable to CI logs and test messages) ---

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length));

/** A single aligned row, e.g. for the full table or a violations list. */
export function formatRow(r: PairResult, baselinedKeys: Set<string> = new Set()): string {
  const status = r.pass
    ? 'ok'
    : baselinedKeys.has(r.key)
      ? 'FAIL (baseline)'
      : r.severity === 'error'
        ? 'FAIL'
        : r.severity.toUpperCase();
  return [
    pad(r.category, 15),
    pad(r.fgToken, 18),
    pad(`on ${r.bgToken}`, 21),
    pad(r.mode, 5),
    pad(r.metric, 5),
    pad(`${r.achieved}`, 7),
    pad(`>= ${r.target}`, 7),
    status,
  ].join('  ');
}

/** The full report table, grouped with failures first within each category. */
export function formatTable(results: PairResult[], outcome?: GateOutcome): string {
  const baselinedKeys = new Set((outcome?.baselinedFailures ?? []).map((r) => r.key));
  const order: Category[] = [
    'text-on-surface',
    'on-emphasis',
    'hue-fg',
    'border',
    'field',
    'text-on-band',
    'transparent',
  ];
  const lines: string[] = [];
  for (const cat of order) {
    const rows = results
      .filter((r) => r.category === cat)
      .sort((a, b) => Number(a.pass) - Number(b.pass) || a.achieved - b.achieved);
    if (!rows.length) continue;
    lines.push('', `# ${cat}`);
    for (const r of rows) lines.push('  ' + formatRow(r, baselinedKeys));
  }
  return lines.join('\n');
}
