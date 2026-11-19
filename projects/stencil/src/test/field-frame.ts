import { render, vi } from '@stencil/vitest';
import { userEvent } from 'vitest/browser';
import { fieldStatusIcon } from '@common/field-status';

import colors from '../../../styles/dist/css/colors-rgb.css?raw';
import semantic from '../../../styles/dist/css/semantic.css?raw';

/**
 * The frame every field shares (#1466, src/tailwind/field-frame.css), tested on each field from
 * its own e2e file: the edge at rest, on hover and on focus, the icon of the status, the required
 * marker, the fill when disabled, and dark with more contrast. The page loads the palette and the
 * semantic layer, so the roles resolve as on a product page and flip with the preferences on
 * <html>; every colour is compared with the role it must be, read in the same state.
 */
export interface FieldFrameCase {
  /** The markup of the field, with the extra attributes given (`required`, `variant="error"`). */
  markup: (attributes?: string) => string;
  /** The element that draws the frame. */
  frameOf: (root: HTMLElement) => HTMLElement;
  /** The element the pointer goes over; the host of the field by default. */
  hoverOf?: (root: HTMLElement) => HTMLElement;
  /** What takes the focus: the element that draws the frame by default. */
  focusOf?: (root: HTMLElement) => HTMLElement;
  /** The variants of a status the field takes, which show an icon (#1466); none to skip. */
  statuses?: Array<'error' | 'info' | 'success' | 'warning'>;
  /** Whether a `required` field shows the required marker on its top border. */
  required?: boolean;
  /** Whether `disabled` disables the field (all but the cells of mds-input-otp, through it). */
  disabled?: boolean;
}

const HUE: Record<string, string> = {
  error: 'danger',
  info: 'info',
  success: 'success',
  warning: 'warning',
};

/** The colour a `--magma-*` role resolves to on the page now, as getComputedStyle writes it. */
export const role = (name: string): string => {
  const probe = document.createElement('span');
  probe.style.color = `var(--magma-${name})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
};

/** The path an icon draws, whether the svg is markup or a data URI. */
const pathOf = (svg: string): string | undefined =>
  /\sd=['"]([^'"]+)['"]/.exec(decodeURIComponent(svg))?.[1];

/** The first shadow of an element, its colour and its spread: the edge of the frame. */
export const edgeOf = (element: HTMLElement): { color: string; spread: string } => {
  const first = getComputedStyle(element)
    .boxShadow.split(/,(?![^(]*\))/)[0]!
    .trim();
  const match = /^(rgba?\([^)]*\)) 0px 0px 0px (\S+)$/.exec(first);
  if (!match) throw new Error(`no edge in "${first}"`);
  return { color: match[1]!, spread: match[2]! };
};

/**
 * Publishes the preferences on <html>, as the controllers do; the store follows them through a
 * MutationObserver, so give it a tick. The reduced animation drops the transitions, so a colour is
 * read where it lands instead of on its way there.
 */
const choose = async (...classes: string[]): Promise<void> => {
  document.documentElement.classList.add('pref-animation-reduce', ...classes);
  await new Promise((resolve) => setTimeout(resolve, 50));
};

/**
 * The pointer stays where the last case left it, and every case renders its field at the top of
 * the page, where Chromium hovers it a few frames later: park it in the bottom right corner first.
 */
const parkPointer = async (): Promise<void> => {
  const corner = document.createElement('span');
  corner.style.cssText = 'position: fixed; right: 0; bottom: 0; width: 8px; height: 8px';
  document.body.append(corner);
  await userEvent.hover(corner);
  corner.remove();
};

/** Loads the palette and the semantic layer in the page for the tests of the block it is in. */
export const usePalette = (): void => {
  let palette: HTMLStyleElement;

  beforeAll(() => {
    palette = document.createElement('style');
    palette.textContent = `${colors}\n${semantic}`;
    document.head.append(palette);
  });

  afterAll(() => palette.remove());
};

export const describeFieldFrame = (tag: string, field: FieldFrameCase): void => {
  const hoverOf = field.hoverOf ?? ((root: HTMLElement) => root);
  const focusOf = field.focusOf ?? field.frameOf;

  describe(`the frame of the field (#1466): ${tag}`, () => {
    usePalette();

    beforeEach(async () => {
      await parkPointer();
      await choose();
    });

    const show = async (attributes = '') => {
      const result = await render<HTMLElement>(field.markup(attributes));
      await vi.waitFor(() => expect(field.frameOf(result.root)).toBeTruthy());
      await result.waitForChanges();
      return result;
    };

    it('draws a neutral 1px edge at rest, the field role', async () => {
      const { root } = await show();

      expect(edgeOf(field.frameOf(root))).toEqual({ color: role('field-border'), spread: '1px' });
    });

    it('darkens the 1px edge on hover, apart from the 3px focus ring in the accent', async () => {
      const { root, waitForChanges } = await show();
      const rest = edgeOf(field.frameOf(root));

      await userEvent.hover(hoverOf(root));
      await waitForChanges();
      const hover = edgeOf(field.frameOf(root));

      focusOf(root).focus();
      await waitForChanges();
      const focus = edgeOf(field.frameOf(root));

      expect(hover).toEqual({ color: role('field-border-hover'), spread: '1px' });
      expect(hover.color).not.toBe(rest.color);
      expect(focus).toEqual({ color: role('accent-emphasis'), spread: '3px' });
    });

    if (field.statuses?.length) {
      it('shows no icon of status on a field with no status', async () => {
        const { root } = await show();

        expect(root.shadowRoot!.querySelector('.status-icon')).toBeNull();
        expect(field.frameOf(root)).not.toHaveClass('has-status');
      });

      it.each(field.statuses)(
        'shows the status %s as its icon inside the field, the edge neutral',
        async (status) => {
          const { root, waitForChanges } = await show(`variant="${status}"`);
          const icon = root.shadowRoot!.querySelector<HTMLElement>('.status-icon')!;
          const emphasis = role(`${HUE[status]}-emphasis`);

          expect(icon).not.toBeNull();
          expect(icon).toEqualAttribute('aria-hidden', 'true');
          // the build inlines the svg, Vite gives the test a data URI: the same path either way
          expect(pathOf(icon.getAttribute('name')!)).toBe(pathOf(fieldStatusIcon(status)!));
          expect(getComputedStyle(icon).fill).toBe(emphasis);
          expect(field.frameOf(root)).toHaveClass('has-status');
          expect(edgeOf(field.frameOf(root))).toEqual({
            color: role('field-border'),
            spread: '1px',
          });

          focusOf(root).focus();
          await waitForChanges();
          expect(edgeOf(field.frameOf(root))).toEqual({ color: emphasis, spread: '3px' });
        },
      );
    }

    if (field.required) {
      it('marks a required field with a neutral marker, danger once it is in error', async () => {
        const { root, waitForChanges } = await show('required');
        const marker = (): HTMLElement =>
          root.shadowRoot!.querySelector<HTMLElement>('mds-input-tip-item[variant="required"]')!;

        expect(marker()).not.toBeNull();
        expect(getComputedStyle(marker()).backgroundColor).toBe(role('field-required'));

        root.setAttribute('variant', 'error');
        await waitForChanges();

        expect(getComputedStyle(marker()).backgroundColor).toBe(role('danger-emphasis'));
      });
    }

    if (field.disabled ?? true) {
      it('fills a disabled field with the same wash as every field', async () => {
        const { root } = await show('disabled');

        expect(getComputedStyle(field.frameOf(root)).backgroundColor).toBe(role('wash-soft'));
      });
    }

    it('reaches the frame of more contrast in dark: the wash fill, the strong edge', async () => {
      // the dark block of each field outranked its contrast block, so in dark the field lost
      // the contrast preference (#1438); the frame now reads roles that flip on :root
      await choose('pref-mode-dark', 'pref-contrast-more');
      const { root } = await show();
      const host = hoverOf(root);

      await vi.waitFor(() => expect(host).toEqualAttribute('pref-contrast', 'more'));
      expect(host).toEqualAttribute('pref-mode', 'dark');
      expect(getComputedStyle(field.frameOf(root)).backgroundColor).toBe(role('wash-base'));
      expect(edgeOf(field.frameOf(root))).toEqual({ color: role('border-strong'), spread: '1px' });
      // and the colours are the dark ones, not the light ones the page started with
      expect(role('field-border')).not.toBe(role('surface-default'));
      expect(role('surface-default')).toBe('rgb(0, 0, 0)');
    });
  });
};
