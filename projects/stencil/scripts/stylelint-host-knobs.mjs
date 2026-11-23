import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import stylelint from 'stylelint';

/*
  magma/host-knobs: every value of a component's look is a knob, a `--mds-<tag>-*` custom
  property declared on :host and documented with @prop, and the rules read only the knobs
  (SPEC.md, Authoring rules, "The knobs on :host", #1499). So a token is read only in the
  declaration of a knob on a :host selector (`:host`, `:host([variant='info'])`,
  `:host-context(...)`, inside any at-rule), or of a role `--magma-*` the component declares
  again on :host for what it holds. Reported:

    - a token read anywhere else: `var(--magma-*)`, `--spacing()`, `--theme()`, a `var()` of the
      Tailwind theme (`--duration-*`, `--ease-*`, `--shadow-*`, `--aspect-*`, `--text-size-*`),
      and any `var()` of a property that is not a knob (`--mds-*`) nor derived (`--private-*`);
      in a property on :host (`:host { gap: --spacing(200) }`), below :host (`.box { ... }`,
      `::slotted()`, `@keyframes`), and in a `--private-*` property, which derives from the
      knobs (a calc(), a pick, a duration set to 0s) and brings no value of its own;
    - an `@apply` of a class whose CSS sets a value of the look (STRUCTURAL and SYSTEM_CLASSES
      below);
    - a `--mds-*` declared and named by no `@prop`, neither of the component that declares it
      nor of the one that owns it, the longest tag its name starts with: a parent may document
      the knob of its items (`--mds-tab-item-default-color` is mds-tab-item's, mds-tab sets it
      and documents it); a name that starts with no tag is reported too.

  Read anywhere, since they are no value of the component: the axes of the system and of the
  page in SYSTEM_TOKENS, the behaviour of the system in SYSTEM_CLASSES. A literal is no token read:
  `0`, `100%`, `display`, the `1px` hairline, a breakpoint in px in a @media pass here
  (magma/token-values owns the literals).

  The document sheets, `css/<tag>-property.css` and `css/<tag>-pre-hydration.css`, are not
  shadow sheets: skipped.

  The baseline (option `pending`, the path of a JSON): a sheet that does not follow the rule yet
  is named there, relative to src/components, with the count of what the rule reports in it
  (`"mds-button/mds-button.css": 40`). A sheet at its count reports nothing; past it, it reports
  everything, the new among the rest; below it, it asks to lower the count, so the list only
  shrinks (decided on #1499: a count per sheet holds every component from the first day, where a
  list of components would skip them whole). A sheet the baseline does not name is held at 0.
  What a stylelint-disable comment hides is not counted, as stylelint would not show it.
  `npm run list.host-knobs` lists what the rule reports, sheet by sheet, and lowers the counts.
*/

const {
  createPlugin,
  utils: { report: stylelintReport, ruleMessages, validateOptions },
} = stylelint;

const ruleName = 'magma/host-knobs';

const messages = ruleMessages(ruleName, {
  read: (read, where, hint) => `Unexpected ${read} ${where}: ${hint}`,
  apply: (name) =>
    `Unexpected @apply ${name}: it sets a value of the look; declare the values as knobs on :host and read them here (a text: -font-size, -font-weight, -line-height, -font-family, -letter-spacing for a title)`,
  undocumented: (name, owner) => `Undocumented knob ${name}: name it in an @prop of ${owner}`,
  unowned: (name) => `Unexpected ${name}: its name starts with no component tag`,
  over: (count, allowed) =>
    `${count} reported in this sheet, ${allowed} allowed by its count in scripts/host-knobs-pending.json: the new ones are among them`,
  lower: (count, allowed) =>
    `${count} reported in this sheet, ${allowed} still allowed by scripts/host-knobs-pending.json: lower its count (npm run list.host-knobs -- --lower)`,
});

const meta = {
  url: 'https://github.com/magma-design-system/magma/blob/main/projects/stencil/SPEC.md#authoring-rules',
};

/*
  The axes of the system and of the page, read anywhere (decided on #1499): the corner shape
  of the theme, and the gutter of the page a component aligns to. Not here, so knobs: the
  aspect ratios and the easings.
*/
export const SYSTEM_TOKENS = new Set(['magma-corner-shape', 'magma-width-page-gutter']);

/*
  The behaviour of the system, the same in every component, applied anywhere: the focus
  indicator (decided on #1499), and the hiding of an inner component before it hydrates (the
  fouc sheets), which waits the 0.1s of projects/styles before it hides.
*/
export const SYSTEM_CLASSES = new Set(['focus-bounce', 'focus-bounce--focused', 'not-hydrated']);

/*
  The classes an @apply may name because they set no value of the look. The criterion: the
  CSS Tailwind writes for the class, from the preamble of the stencil build, reads no variable
  of the theme and writes no length or duration but 0 and the 1px hairline, as if written in
  the sheet in its place it broke neither this rule nor magma/token-values (the block for
  forced colours aside, the colours of the system). The list is closed: a class it does not
  name is reported, and scripts/stylelint-host-knobs.spec.ts compiles each one on the built
  theme to hold the criterion. A responsive variant (`desktop:hidden`) is a condition: the
  class after it decides.
*/
export const STRUCTURAL = new Set([
  'antialiased',
  'auto-rows-min',
  'flex',
  'grid-cols-full',
  'hidden',
  'hide-scrollbar',
  'opacity-100',
  'outline-hidden',
  'sr-only',
  'text-box-vertical-margin',
  'truncate',
]);

/* the document sheets of a component, collected into the global ones: not shadow sheets */
const DOCUMENT_SHEET = /-(?:property|pre-hydration)\.css$/;

// comments, strings and url() never carry a read: blanked, so that the offsets still point
// into the declaration
const UNCHECKED = /\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|url\([^)]*\)/gi;

// a var() of a custom property, or a Tailwind function that reads the theme
const READ = /var\(\s*--([\w-]+)|--(spacing|theme)\(/g;

// the custom properties a component reads freely: its knobs, what derives from them, and the
// internals Tailwind writes (`--tw-*`)
const FREE = /^(?:mds|private|tw)-/;

const PROP = /@prop\s+(--[\w-]+)/g;

/**
 * The parts of a selector list, split on its top-level commas.
 */
const splitList = (selector) => {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of selector) {
    if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
};

/**
 * The selectors a nested rule stands for, its parents' resolved into it (`&`, or a
 * descendant when it has none). An at-rule between them changes no selector.
 */
export const resolveSelectors = (rule) => {
  const chain = [];
  for (let node = rule; node && node.type !== 'root'; node = node.parent) {
    if (node.type === 'rule') chain.unshift(node.selector);
  }
  let selectors = [''];
  for (const selector of chain) {
    selectors = selectors.flatMap((parent) =>
      splitList(selector).map((part) => {
        if (part.includes('&')) return part.replaceAll('&', parent);
        return parent ? `${parent} ${part}` : part;
      }),
    );
  }
  return selectors;
};

/**
 * Whether a selector matches the host itself: `:host` or `:host-context()` with its states,
 * no combinator and no pseudo-element after it.
 */
export const isHostSelector = (selector) => {
  if (!/^:host(?:-context)?(?![\w-])/.test(selector)) return false;
  let depth = 0;
  for (const char of selector) {
    if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    else if (depth === 0 && /[\s>+~]/.test(char)) return false;
  }
  return !selector.includes('::');
};

/**
 * Where a declaration sits: on the host, below it, or nowhere the rule looks (a @property,
 * a @font-face).
 */
const placeOf = (decl) => {
  for (let node = decl.parent; node && node.type !== 'root'; node = node.parent) {
    if (node.type === 'atrule') {
      const name = node.name.toLowerCase();
      if (name === 'property' || name === 'font-face') return 'none';
      if (name.endsWith('keyframes')) return 'below';
    }
  }
  if (decl.parent.type !== 'rule') return 'none';
  return resolveSelectors(decl.parent).every(isHostSelector) ? 'host' : 'below';
};

/**
 * The component tag and the folder of the components, from the path of the sheet.
 */
const componentOf = (file) => {
  const match = file
    ?.split(sep)
    .join('/')
    .match(/^(.*\/src\/components)\/(mds-[^/]+)\//);
  return match ? { components: match[1], tag: match[2] } : null;
};

/**
 * Every .css under a folder.
 */
const sheetsIn = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sheetsIn(path);
    return name.endsWith('.css') ? [path] : [];
  });

/**
 * The custom properties a component names in an @prop of its sheets.
 */
const documentedIn = (components, tag) => {
  const dir = join(components, tag);
  if (!existsSync(dir)) return new Set();
  return new Set(
    sheetsIn(dir).flatMap((path) =>
      [...readFileSync(path, 'utf8').matchAll(PROP)].map((match) => match[1]),
    ),
  );
};

/**
 * The component a knob belongs to: the longest tag its name starts with.
 */
const ownerOf = (name, tags) => {
  let owner = null;
  for (const tag of tags) {
    const owns = name === `--${tag}` || name.startsWith(`--${tag}-`);
    if (owns && (!owner || tag.length > owner.length)) owner = tag;
  }
  return owner;
};

/**
 * What to write instead of a read, for the message.
 */
const placeHint = (decl, place, tag) => {
  const knob = `--${tag ?? 'mds-<tag>'}-*`;
  if (place === 'below') return ['below :host', `read a knob ${knob} declared on :host`];
  if (decl.prop.startsWith('--private-')) {
    return [
      `in ${decl.prop}`,
      `a --private-* property derives from the knobs: declare the value as a knob ${knob}`,
    ];
  }
  if (decl.prop.startsWith('--'))
    return [`in ${decl.prop}`, `it is not a knob: name it ${knob} and document it with @prop`];
  return ['on :host', `declare a knob ${knob} with this value on :host and read it here`];
};

/**
 * The class an @apply names, its variants and the important mark taken away.
 */
export const baseClass = (name) => {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < name.length; i++) {
    if (name[i] === '[' || name[i] === '(') depth++;
    else if (name[i] === ']' || name[i] === ')') depth--;
    else if (name[i] === ':' && depth === 0) start = i + 1;
  }
  return name.slice(start).replace(/^!|!$/g, '');
};

/**
 * Whether a stylelint-disable comment hides a line from the rule, as stylelint's own report()
 * decides (lib/utils/report.mjs, isDisabledOnLine).
 */
const isDisabledOnLine = (result, line) => {
  const { config, disabledRanges = {} } = result.stylelint;
  if (config?.ignoreDisables) return false;
  const ranges = disabledRanges[ruleName] ?? disabledRanges.all ?? [];
  return ranges.some(
    (range) =>
      range.start <= line &&
      (range.end === undefined || range.end >= line) &&
      (!range.rules || range.rules.includes(ruleName)),
  );
};

/**
 * The count the baseline allows a sheet, 0 when it does not name it.
 */
const allowedFor = (pending, key) => {
  if (!pending || !key || !existsSync(pending)) return 0;
  return JSON.parse(readFileSync(pending, 'utf8'))[key] ?? 0;
};

/** @type {import('stylelint').Rule} */
const ruleFunction = (primary, secondary) => (root, result) => {
  const validOptions = validateOptions(
    result,
    ruleName,
    { actual: primary, possible: [true] },
    {
      actual: secondary,
      possible: { pending: [(value) => typeof value === 'string'] },
      optional: true,
    },
  );
  const file = root.source?.input.file;
  if (!validOptions || (file && DOCUMENT_SHEET.test(file))) {
    return;
  }

  // reported at the end, once the count of the sheet is known
  const problems = [];
  const report = (problem) => problems.push(problem);

  const component = componentOf(file);
  const tags = component
    ? readdirSync(component.components).filter((name) => name.startsWith('mds-'))
    : [];
  const documented = new Map();
  const isDocumented = (owner, name) => {
    if (!documented.has(owner)) documented.set(owner, documentedIn(component.components, owner));
    return documented.get(owner).has(name);
  };

  root.walkDecls((decl) => {
    const place = placeOf(decl);
    if (place === 'none') return;

    if (component && decl.prop.startsWith('--mds-')) {
      const owner = ownerOf(decl.prop, tags);
      if (!owner) {
        report({
          message: messages.unowned(decl.prop),
          node: decl,
          result,
          ruleName,
          word: decl.prop,
        });
      } else if (!isDocumented(component.tag, decl.prop) && !isDocumented(owner, decl.prop)) {
        report({
          message: messages.undocumented(decl.prop, owner),
          node: decl,
          result,
          ruleName,
          word: decl.prop,
        });
      }
    }

    const knob = place === 'host' && /^--(?:mds|magma)-/.test(decl.prop);
    if (knob) return;

    const valueIndex = decl.prop.length + (decl.raws.between ?? ':').length;
    const value = decl.value.replace(UNCHECKED, (match) => ' '.repeat(match.length));
    for (const match of value.matchAll(READ)) {
      const [read, name, fn] = match;
      if (name && (FREE.test(name) || SYSTEM_TOKENS.has(name))) continue;
      const [where, hint] = placeHint(decl, place, component?.tag);
      const shown = fn ? `--${fn}()` : `var(--${name})`;
      report({
        endIndex: valueIndex + match.index + read.length,
        index: valueIndex + match.index,
        message: messages.read(shown, where, hint),
        node: decl,
        result,
        ruleName,
      });
    }
  });

  root.walkAtRules('apply', (atRule) => {
    for (const name of atRule.params.split(/\s+/).filter(Boolean)) {
      const base = baseClass(name);
      if (STRUCTURAL.has(base) || SYSTEM_CLASSES.has(base)) continue;
      report({ message: messages.apply(name), node: atRule, result, ruleName, word: name });
    }
  });

  const shown = problems.filter(
    (problem) =>
      !isDisabledOnLine(
        result,
        problem.node.rangeBy({ index: problem.index, endIndex: problem.endIndex }).start.line,
      ),
  );
  const key =
    component &&
    file
      .split(sep)
      .join('/')
      .slice(component.components.length + 1);
  const allowed = allowedFor(secondary?.pending, key);
  if (shown.length < allowed) {
    stylelintReport({
      endIndex: 0,
      index: 0,
      message: messages.lower(shown.length, allowed),
      node: root,
      result,
      ruleName,
    });
  } else if (shown.length > allowed) {
    if (allowed > 0) {
      stylelintReport({
        endIndex: 0,
        index: 0,
        message: messages.over(shown.length, allowed),
        node: root,
        result,
        ruleName,
      });
    }
    for (const problem of problems) stylelintReport(problem);
  }
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
ruleFunction.meta = meta;

export default createPlugin(ruleName, ruleFunction);
