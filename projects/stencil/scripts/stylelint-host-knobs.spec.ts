import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import postcss from 'postcss';
import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import { STRUCTURAL, SYSTEM_CLASSES, baseClass, isHostSelector } from './stylelint-host-knobs.mjs';

const PROJECT = resolve(__dirname, '..');
const PLUGIN = resolve(__dirname, 'stylelint-host-knobs.mjs');
const COMPONENTS = join(PROJECT, 'src/components');

/**
 * A folder of components on disk, so that the rule can read the @prop of each: by tag, the
 * sheets of the component relative to its folder.
 */
const fixture = (components: Record<string, Record<string, string>>): string => {
  const root = join(mkdtempSync(join(tmpdir(), 'host-knobs-')), 'src/components');
  for (const [tag, sheets] of Object.entries(components)) {
    for (const [name, css] of Object.entries(sheets)) {
      mkdirSync(dirname(join(root, tag, name)), { recursive: true });
      writeFileSync(join(root, tag, name), css);
    }
  }
  return root;
};

/**
 * The messages magma/host-knobs reports for a stylesheet, as the sheet of a component when
 * `file` is given.
 */
const lint = async (code: string, file?: string, pending?: string): Promise<string[]> => {
  const { results } = await stylelint.lint({
    code,
    codeFilename: file,
    config: {
      plugins: [PLUGIN],
      rules: { 'magma/host-knobs': pending ? [true, { pending }] : true },
    },
  });
  return results[0].warnings.map((warning) => warning.text.replace(/ \(magma\/host-knobs\)$/, ''));
};

describe('magma/host-knobs: where a token is read', () => {
  it('lets a knob or a role declared again on :host read a token, in any state and at-rule', async () => {
    const css = `
:host {
  --mds-a-gap: --spacing(200);
  --mds-a-background: rgb(var(--magma-surface-raised));
  --magma-surface-default: var(--magma-surface-overlay);
  --private-a-gap: calc(var(--mds-a-gap) * 2);
  gap: var(--mds-a-gap);
}

:host([variant='info']), :host-context(.dark):hover {
  --mds-a-background: rgb(var(--magma-info-wash-base));
}

@media (width < 1024px) {
  :host(:not([dock='none'])) {
    --mds-a-shadow: var(--shadow-2xl);

    &[zoomed] {
      --mds-a-radius: var(--magma-radius-lg);
    }
  }
}

.box {
  background-color: var(--mds-a-background);
  padding: var(--private-a-gap);
}`;

    expect(await lint(css)).toEqual([]);
  });

  it('reports a token read in a property of :host, below :host and in a --private-* property', async () => {
    const css = `
:host {
  --private-a-fill: var(--magma-accent-emphasis);
  --size: --spacing(400);
  gap: --spacing(200);

  .box {
    --mds-a-color: rgb(var(--magma-text-muted));
  }
}

:host > .item, ::slotted(*) {
  transition-duration: var(--duration-200);
}

@keyframes pulse {
  to { scale: var(--magma-scale); }
}

.frame {
  aspect-ratio: var(--aspect-video);
  transition-timing-function: var(--ease-out);
  max-width: --theme(--container-2xs);
}`;

    expect(await lint(css)).toEqual([
      'Unexpected var(--magma-accent-emphasis) in --private-a-fill: a --private-* property derives from the knobs: declare the value as a knob --mds-<tag>-*',
      'Unexpected --spacing() in --size: it is not a knob: name it --mds-<tag>-* and document it with @prop',
      'Unexpected --spacing() on :host: declare a knob --mds-<tag>-* with this value on :host and read it here',
      'Unexpected var(--magma-text-muted) below :host: read a knob --mds-<tag>-* declared on :host',
      'Unexpected var(--duration-200) below :host: read a knob --mds-<tag>-* declared on :host',
      'Unexpected var(--magma-scale) below :host: read a knob --mds-<tag>-* declared on :host',
      'Unexpected var(--aspect-video) below :host: read a knob --mds-<tag>-* declared on :host',
      'Unexpected var(--ease-out) below :host: read a knob --mds-<tag>-* declared on :host',
      'Unexpected --theme() below :host: read a knob --mds-<tag>-* declared on :host',
    ]);
  });

  it('reads the axes of the system and of the page anywhere, and the literals are not its business', async () => {
    const css = `
.box {
  border: 1px solid var(--mds-a-border-color);
  corner-shape: var(--mds-a-corner-shape, var(--magma-corner-shape));
  display: grid;
  margin: 0;
  right: var(--magma-width-page-gutter);
  width: 100%;
}

@media (width < 1024px) {
  .box { inset: 0; }
}`;

    expect(await lint(css)).toEqual([]);
  });

  it('skips comments, strings, url(), @property and the document sheets', async () => {
    const css = `
@property --mds-a-size { syntax: '<length>'; inherits: true; initial-value: 0; }
.box {
  /* var(--magma-text-muted) */
  content: 'var(--magma-text-muted)';
  background-image: url('var(--magma-x).svg');
}`;
    const root = fixture({ 'mds-a': { 'css/mds-a-property.css': '' } });

    expect(await lint(css)).toEqual([]);
    expect(
      await lint('.box { gap: --spacing(200); }', join(root, 'mds-a/css/mds-a-pre-hydration.css')),
    ).toEqual([]);
    expect(
      await lint('.box { gap: --spacing(200); }', join(root, 'mds-a/css/mds-a-property.css')),
    ).toEqual([]);
  });
});

describe('magma/host-knobs: @apply', () => {
  it('lets through the classes that set no value of the look and the focus indicator', async () => {
    const css = `
:host {
  @apply focus-bounce;
}

.label {
  @apply antialiased truncate text-box-vertical-margin desktop:hidden max-tablet:flex;
}`;

    expect(await lint(css)).toEqual([]);
  });

  it('reports a class of the look: a text, an easing, a length', async () => {
    expect(await lint('.label { @apply text-info-detail ease-out pr-800; }')).toEqual([
      'Unexpected @apply text-info-detail: it sets a value of the look; declare the values as knobs on :host and read them here (a text: -font-size, -font-weight, -line-height, -font-family, -letter-spacing for a title)',
      'Unexpected @apply ease-out: it sets a value of the look; declare the values as knobs on :host and read them here (a text: -font-size, -font-weight, -line-height, -font-family, -letter-spacing for a title)',
      'Unexpected @apply pr-800: it sets a value of the look; declare the values as knobs on :host and read them here (a text: -font-size, -font-weight, -line-height, -font-family, -letter-spacing for a title)',
    ]);
  });

  it('decides on the class after its variants', () => {
    expect(baseClass('desktop:hidden')).toBe('hidden');
    expect(baseClass('max-tablet:[&>svg]:flex!')).toBe('flex');
    expect(baseClass('truncate')).toBe('truncate');
  });
});

describe('magma/host-knobs: every knob documented', () => {
  const root = fixture({
    'mds-a': {
      'mds-a.css':
        '/**\n * @prop --mds-a-gap: Public. The gap\n * @prop --mds-a-item-color: The colour of the items\n */',
    },
    'mds-a-item': { 'mds-a-item.css': '/**\n * @prop --mds-a-item-gap: The gap\n */' },
  });

  it('wants an @prop of the component that declares the knob or of the one that owns it', async () => {
    const css = `
:host {
  --mds-a-gap: --spacing(200);
  --mds-a-item-color: rgb(var(--magma-text-muted));
  --mds-a-item-gap: --spacing(100);
  --mds-a-radius: var(--magma-radius-md);
  --mds-b-size: --spacing(400);
}`;

    expect(await lint(css, join(root, 'mds-a/css/mds-a-variant.css'))).toEqual([
      'Undocumented knob --mds-a-radius: name it in an @prop of mds-a',
      'Unexpected --mds-b-size: its name starts with no component tag',
    ]);
  });

  it('names the prefix of the component in its messages', async () => {
    expect(await lint('.box { gap: --spacing(200); }', join(root, 'mds-a/mds-a.css'))).toEqual([
      'Unexpected --spacing() below :host: read a knob --mds-a-* declared on :host',
    ]);
  });
});

describe('magma/host-knobs: the baseline', () => {
  const root = fixture({ 'mds-a': { 'mds-a.css': '' } });
  const file = join(root, 'mds-a/mds-a.css');
  const pending = join(root, 'pending.json');
  const css = ':host { gap: --spacing(200); }\n.box { padding: --spacing(400); }';

  it('says nothing for a sheet at its count', async () => {
    writeFileSync(pending, JSON.stringify({ 'mds-a/mds-a.css': 2 }));

    expect(await lint(css, file, pending)).toEqual([]);
  });

  it('reports everything past the count, and asks to lower a count above what it reports', async () => {
    writeFileSync(pending, JSON.stringify({ 'mds-a/mds-a.css': 1 }));
    const over = await lint(css, file, pending);
    writeFileSync(pending, JSON.stringify({ 'mds-a/mds-a.css': 3 }));
    const under = await lint(css, file, pending);

    expect(over).toEqual([
      '2 reported in this sheet, 1 allowed by its count in scripts/host-knobs-pending.json: the new ones are among them',
      'Unexpected --spacing() on :host: declare a knob --mds-a-* with this value on :host and read it here',
      'Unexpected --spacing() below :host: read a knob --mds-a-* declared on :host',
    ]);
    expect(under).toEqual([
      '2 reported in this sheet, 3 still allowed by scripts/host-knobs-pending.json: lower its count (npm run list.host-knobs -- --lower)',
    ]);
  });

  it('holds a sheet it does not name at 0, and does not count what a disable comment hides', async () => {
    writeFileSync(pending, JSON.stringify({}));
    const disabled = `:host { gap: --spacing(200); }
.box {
  /* stylelint-disable-next-line magma/host-knobs -- a reason */
  padding: --spacing(400);
}`;

    expect(await lint(css, file, pending)).toHaveLength(2);
    expect(await lint(disabled, file, pending)).toEqual([
      'Unexpected --spacing() on :host: declare a knob --mds-a-* with this value on :host and read it here',
    ]);
  });
});

describe('magma/host-knobs: the selectors of the host', () => {
  it('takes the host with its states, not what is below it', () => {
    expect(isHostSelector(':host')).toBe(true);
    expect(isHostSelector(":host([variant='info'], [tone='a b'])")).toBe(true);
    expect(isHostSelector(':host-context(.dark):hover')).toBe(true);
    expect(isHostSelector(':host .box')).toBe(false);
    expect(isHostSelector(':host>.box')).toBe(false);
    expect(isHostSelector(':host::before')).toBe(false);
    expect(isHostSelector('::slotted(*)')).toBe(false);
    expect(isHostSelector(':hostile')).toBe(false);
  });
});

describe('magma/host-knobs: on the real data', () => {
  const pending = JSON.parse(
    readFileSync(join(__dirname, 'host-knobs-pending.json'), 'utf8'),
  ) as Record<string, number>;

  it('keeps a baseline of sheets that exist, sorted, with a count above 0', () => {
    const sheets = Object.keys(pending);

    expect(sheets.filter((sheet) => !existsSync(join(COMPONENTS, sheet)))).toEqual([]);
    expect(sheets).toEqual([...sheets].sort());
    expect(Object.values(pending).filter((count) => !Number.isInteger(count) || count < 1)).toEqual(
      [],
    );
  });

  /*
    The criterion of STRUCTURAL, on the theme the stencil build compiles the sheets with (the
    preamble of stencil.config.ts, the references imported so that the classes are written
    out): the CSS of each class reads no variable of the theme and writes no length or duration
    but 0 and the 1px hairline. The block for forced colours is the colours of the system, not
    of the component: left aside. Needs the build of design-tokens and styles.
  */
  it('lets @apply name only classes whose CSS sets no value of the look', async () => {
    const require = createRequire(join(PROJECT, 'package.json'));
    const { compile } = require('@tailwindcss/node') as typeof import('@tailwindcss/node');
    const preamble = `@import "tailwindcss/theme.css" layer(theme);
@import "@maggioli-design-system/styles/dist/tailwind/theme.css";
@import "@maggioli-design-system/styles/dist/tailwind/typography.css";
@import "@maggioli-design-system/styles/dist/css/animations.css";
@import "${join(PROJECT, 'src/tailwind/utilities.css')}";
@import "tailwindcss/utilities.css" layer(utilities);`;

    const written: Record<string, string[]> = {};
    for (const name of [...STRUCTURAL, ...SYSTEM_CLASSES]) {
      const compiler = await compile(preamble, { base: PROJECT, onDependency: () => {} });
      const css = postcss.parse(compiler.build([name]));
      const values: string[] = [];
      css.walkAtRules('layer', (layer) => {
        if (layer.params !== 'utilities') return;
        layer.walkAtRules('media', (media) => {
          if (media.params.includes('forced-colors')) media.remove();
        });
        layer.walkDecls((decl) => {
          values.push(decl.value);
        });
      });
      written[name] = values;
    }
    const look = (values: string[]): boolean =>
      values.some(
        (value) =>
          /var\(\s*--(?!tw-)/.test(value) ||
          [
            ...value.matchAll(/(?<![\w.#-])([+-]?(?:\d+\.?\d*|\.\d+))(px|rem|ms|s)(?![\w%-])/g),
          ].some(
            ([, number, unit]) =>
              Number(number) !== 0 && !(unit === 'px' && Math.abs(Number(number)) === 1),
          ),
      );

    expect([...STRUCTURAL].filter((name) => written[name].length === 0)).toEqual([]);
    expect([...STRUCTURAL].filter((name) => look(written[name]))).toEqual([]);
    // the focus indicator and the hiding before hydration set values of the system: exceptions,
    // not structural classes
    expect([...SYSTEM_CLASSES].every((name) => look(written[name]))).toBe(true);
  });
});
