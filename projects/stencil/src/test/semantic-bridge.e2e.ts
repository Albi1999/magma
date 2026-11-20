import colors from '../../../styles/dist/css/colors-rgb.css?raw';
import globals from '../../../styles/dist/css/globals.css?raw';
import semantic from '../../../styles/dist/css/semantic.css?raw';
import bridge from '../../../styles/dist/tailwind/semantic.css?raw';

/**
 * The Tailwind bridge of the semantic layer writes every role with its light default as the
 * fallback of its var(): `--color-surface-default: var(--magma-surface-default, rgb(242 242
 * 242))`. Tailwind IntelliSense reads the colour of a utility only from that literal, so the
 * fallback is what the editor shows next to `bg-surface-default`. It has to be the colour the
 * role really has on a light page, or the swatch lies.
 */
describe('the fallbacks of the semantic Tailwind bridge', () => {
  const html = document.documentElement;
  let sheet: HTMLStyleElement;

  // a transparent role (#1472) falls back to the ink with its alpha, `rgb(5 5 5 / 0.0451)`
  const roles = [
    ...bridge.matchAll(/var\(--(magma-[a-z0-9-]+), (rgb\(\d+ \d+ \d+(?: \/ [\d.]+)?\))\)/g),
  ].map(([, role, fallback]) => ({ role, fallback }));

  beforeEach(() => {
    sheet = document.createElement('style');
    sheet.textContent = [colors, globals, semantic].join('\n');
    document.head.append(sheet);
    // a light page with a controller: no OS preference can switch the mode
    html.setAttribute('data-magma-pref', '');
    html.classList.add('pref-mode-light');
  });

  afterEach(() => {
    sheet.remove();
    html.removeAttribute('data-magma-pref');
  });

  it('gives every role of the bridge a fallback', () => {
    const declared = bridge.match(/^\s*--color-[a-z0-9-]+:/gm) ?? [];

    expect(roles.length).toBeGreaterThan(100);
    expect(roles).toHaveLength(declared.length);
  });

  it('falls back to the colour each role has on a light page', () => {
    const probe = document.createElement('div');
    document.body.append(probe);
    // the colour as painted over white: a mix comes back as oklab(), its fallback as rgba(), the
    // same colour written two ways
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const paint = canvas.getContext('2d', { willReadFrequently: true })!;
    const colourOf = (value: string): string => {
      probe.style.color = value;
      paint.fillStyle = '#fff';
      paint.fillRect(0, 0, 1, 1);
      paint.fillStyle = getComputedStyle(probe).color;
      paint.fillRect(0, 0, 1, 1);
      return [...paint.getImageData(0, 0, 1, 1).data].join(' ');
    };

    const wrong = roles
      .map(({ role, fallback }) => ({
        role,
        fallback: colourOf(fallback),
        page: colourOf(`var(--${role})`),
      }))
      .filter(({ fallback, page }) => fallback !== page);
    probe.remove();

    expect(wrong).toEqual([]);
  });
});
