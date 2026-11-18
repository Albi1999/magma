import { h } from '@stencil/core';
import { expect } from 'storybook/test';

/**
 * A link sets the preferences a story opens in (#1436): the Storybook globals named after the
 * panel's preferences and the language (.storybook/preferences.mjs, LINKED), as in
 * `iframe.html?id=common-tests-preferences-from-a-link--dark-reduced-motion&globals=mode:dark;animation:reduce`.
 * A story sets them the same way, with its own `globals`: what a link does, held by a test.
 */
export default {
  title: 'Common tests / Preferences from a link',
};

export const DarkReducedMotion = {
  globals: { mode: 'dark', animation: 'reduce' },
  render: () => (
    <div class="grid gap-400">
      <mds-text typography="h5">Dark, with reduced motion</mds-text>
      <mds-text>
        The preferences of this story come from its globals, as they come from a link with{' '}
        <mds-text typography="hack">globals=mode:dark;animation:reduce</mds-text>; the ones the
        panel keeps are not changed.
      </mds-text>
    </div>
  ),
  play: async () => {
    const html = document.documentElement;
    await expect(html.classList.contains('pref-mode-dark')).toBe(true);
    await expect(html.style.getPropertyValue('--magma-pref-mode')).toBe('dark');
    await expect(html.classList.contains('pref-animation-reduce')).toBe(true);
    await expect(html.hasAttribute('data-magma-pref')).toBe(true);
    // shown, not kept: the link does not change the preferences the person keeps
    await expect(window.localStorage.getItem('mdsPrefMode')).not.toBe('dark');
    await expect(window.localStorage.getItem('mdsPrefAnimation')).not.toBe('reduce');
  },
};
