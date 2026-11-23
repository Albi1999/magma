import { render } from '@stencil/vitest';
import { mockIconFetch } from '@test/fetch';
import { useLanguage } from '@test/language';
import { page, userEvent } from 'vitest/browser';

const LABEL = 'The theme Magma on a page of a product, light mode';

const head = '<mds-text slot="head" typography="section" tag="h2">Preview</mds-text>';
const conditions =
  '<mds-tab slot="conditions" size="sm"><mds-tab-item label="Light" value="light" selected></mds-tab-item><mds-tab-item label="Dark" value="dark"></mds-tab-item></mds-tab>';

const part = (root: HTMLElement, selector: string): HTMLElement =>
  root.shadowRoot!.querySelector(selector) as HTMLElement;

// the preview and the Magma elements in it and in its shadow root have loaded
const hydrated = (root: Element) =>
  vi.waitFor(() => {
    for (const element of [root, ...root.querySelectorAll('*')].filter((one) =>
      one.tagName.startsWith('MDS-'),
    ))
      expect(element).toHaveAttribute('hydrated');
    for (const inner of root.shadowRoot?.querySelectorAll('mds-button') ?? [])
      expect(inner).toHaveAttribute('hydrated');
  });

const preview = async (html: string): Promise<HTMLMdsPreviewElement> => {
  const { root } = await render<HTMLElement>(html);
  const element = (
    root.localName === 'mds-preview' ? root : root.querySelector('mds-preview')
  ) as HTMLMdsPreviewElement;
  await hydrated(element);
  return element;
};

// the viewport the CSS of the window reads: the page without its scrollbar
const view = () => ({
  width: document.documentElement.clientWidth,
  height: document.documentElement.clientHeight,
});

describe('mds-preview', () => {
  beforeEach(() => {
    mockIconFetch();
  });

  afterEach(async () => {
    // the size of the browser project in vitest.config.mts
    await page.viewport(1280, 800);
  });

  describe('region and title', () => {
    it('is a region named by label', async () => {
      const root = await preview(`<mds-preview label="${LABEL}"><iframe></iframe></mds-preview>`);

      expect(root).toHaveAttribute('role', 'region');
      expect(root).toHaveAttribute('aria-label', LABEL);
    });

    it('titles an iframe in the default slot with label, and follows it', async () => {
      const root = await preview(`<mds-preview label="${LABEL}"><iframe></iframe></mds-preview>`);
      const frame = root.querySelector('iframe')!;

      expect(frame).toHaveAttribute('title', LABEL);

      root.label = 'The theme Warm on a page of a product, dark mode';
      await vi.waitFor(() =>
        expect(frame).toHaveAttribute('title', 'The theme Warm on a page of a product, dark mode'),
      );
      // the host takes it on its next render
      await vi.waitFor(() =>
        expect(root).toHaveAttribute(
          'aria-label',
          'The theme Warm on a page of a product, dark mode',
        ),
      );
    });

    it('titles an iframe added to the default slot later', async () => {
      const root = await preview(`<mds-preview label="${LABEL}"></mds-preview>`);
      const frame = document.createElement('iframe');

      root.append(frame);

      await vi.waitFor(() => expect(frame).toHaveAttribute('title', LABEL));
    });

    it('leaves the title of an element that is not an iframe alone', async () => {
      const root = await preview(
        `<mds-preview label="${LABEL}"><div title="A part">A part</div></mds-preview>`,
      );

      expect(root.querySelector('div')).toHaveAttribute('title', 'A part');
    });
  });

  describe('scale', () => {
    // decided on #1491 (B): drawn at the width of its box or at `width`, whichever is wider, and
    // scaled down to the box, never enlarged
    it('draws the result at width and scales it down to a narrower box', async () => {
      const root = await preview(
        `<div style="width: 600px"><mds-preview label="${LABEL}" dock="none"><iframe></iframe></mds-preview></div>`,
      );
      const frame = part(root, '.frame');
      const canvas = part(root, '.canvas');

      expect(root.querySelector('iframe')!.offsetWidth).toBe(1024);
      expect(canvas.getBoundingClientRect().width).toBeCloseTo(frame.clientWidth, 0);
    });

    it('draws the result at the width of a box wider than width, unscaled', async () => {
      const root = await preview(
        `<div style="width: 1200px"><mds-preview label="${LABEL}" width="800"><iframe></iframe></mds-preview></div>`,
      );
      const frame = part(root, '.frame');

      expect(root.querySelector('iframe')!.offsetWidth).toBe(frame.clientWidth);
      expect(part(root, '.canvas').getBoundingClientRect().width).toBeCloseTo(frame.clientWidth, 0);
    });

    it('draws at the width it is given', async () => {
      const root = await preview(
        `<div style="width: 600px"><mds-preview label="${LABEL}" width="1440"><iframe></iframe></mds-preview></div>`,
      );

      expect(root.querySelector('iframe')!.offsetWidth).toBe(1440);
    });

    it('draws at 1024 when width is not a positive number', async () => {
      const root = await preview(
        `<div style="width: 600px"><mds-preview label="${LABEL}" width="0"><iframe></iframe></mds-preview></div>`,
      );

      expect(root.querySelector('iframe')!.offsetWidth).toBe(1024);
    });

    it('fills the height its host is given', async () => {
      const root = await preview(
        `<div style="display: grid; width: 800px; height: 500px"><mds-preview label="${LABEL}">${head}<iframe></iframe></mds-preview></div>`,
      );

      expect(part(root, '.frame').getBoundingClientRect().bottom).toBeCloseTo(
        root.getBoundingClientRect().bottom,
        0,
      );
    });

    it('takes a height of its own when its host has none', async () => {
      const root = await preview(
        `<div style="width: 800px"><mds-preview label="${LABEL}"><iframe></iframe></mds-preview></div>`,
      );

      expect(part(root, '.frame').getBoundingClientRect().height).toBeGreaterThan(0);
    });
  });

  describe('from the desktop breakpoint', () => {
    it('stays in the flow of the page with no lens', async () => {
      const root = await preview(
        `<mds-preview label="${LABEL}">${head}${conditions}<iframe></iframe></mds-preview>`,
      );

      expect(getComputedStyle(part(root, '.box')).position).not.toBe('fixed');
      expect(part(root, '.lens')).not.toBeVisible();
      expect(root.querySelector('[slot="head"]')).toBeVisible();
      expect(root.querySelector('[slot="conditions"]')).toBeVisible();
    });

    it('ignores Escape while zoomed', async () => {
      const root = await preview(
        `<mds-preview label="${LABEL}" zoomed>${head}<iframe></iframe></mds-preview>`,
      );
      const zoom = vi.fn();
      root.addEventListener('mdsPreviewZoom', zoom);

      root.querySelector<HTMLElement>('[slot="head"]')!.tabIndex = -1;
      root.querySelector<HTMLElement>('[slot="head"]')!.focus();
      await userEvent.keyboard('{Escape}');

      expect(root.zoomed).toBe(true);
      expect(zoom).not.toHaveBeenCalled();
    });
  });

  describe('under the desktop breakpoint', () => {
    beforeEach(async () => {
      await page.viewport(768, 680);
    });

    it('docks in the bottom-right corner of the window, at the width it is given', async () => {
      const root = await preview(
        `<mds-preview label="${LABEL}" style="--mds-preview-docked-width: 300px"><iframe></iframe></mds-preview>`,
      );
      const box = part(root, '.box');
      const style = getComputedStyle(box);
      const rect = box.getBoundingClientRect();

      expect(style.position).toBe('fixed');
      expect(style.width).toBe('300px');
      expect(rect.right).toBeCloseTo(view().width - parseFloat(style.right), 0);
      expect(rect.bottom).toBeCloseTo(view().height - parseFloat(style.bottom), 0);
      expect(rect.left).toBeGreaterThan(view().width / 2);
    });

    it('docks in the bottom-left corner', async () => {
      const root = await preview(
        `<mds-preview label="${LABEL}" dock="bottom-left"><iframe></iframe></mds-preview>`,
      );
      const box = part(root, '.box');
      const rect = box.getBoundingClientRect();

      expect(getComputedStyle(box).position).toBe('fixed');
      expect(rect.left).toBeCloseTo(parseFloat(getComputedStyle(box).left), 0);
      expect(rect.right).toBeLessThan(view().width / 2);
    });

    it('stays in the flow with dock="none", with no lens', async () => {
      const root = await preview(
        `<mds-preview label="${LABEL}" dock="none"><iframe></iframe></mds-preview>`,
      );

      expect(getComputedStyle(part(root, '.box')).position).not.toBe('fixed');
      expect(part(root, '.lens')).not.toBeVisible();
    });

    it('scales the result down to the docked box', async () => {
      const root = await preview(`<mds-preview label="${LABEL}"><iframe></iframe></mds-preview>`);
      const frame = part(root, '.frame');

      expect(root.querySelector('iframe')!.offsetWidth).toBe(1024);
      expect(part(root, '.canvas').getBoundingClientRect().width).toBeCloseTo(frame.clientWidth, 0);
    });

    it('keeps the title at the start of the head and hides the conditions while small', async () => {
      const root = await preview(
        `<mds-preview label="${LABEL}">${head}${conditions}<iframe></iframe></mds-preview>`,
      );

      expect(part(root, '.box')).toHaveClass('has-head');
      expect(root.querySelector('[slot="head"]')).toBeVisible();
      expect(root.querySelector('[slot="conditions"]')).not.toBeVisible();
      expect(part(root, '.lens')).toBeVisible();
      expect(part(root, '.title').getBoundingClientRect().left).toBeLessThan(
        part(root, '.lens').getBoundingClientRect().left,
      );
    });

    it('sets the lens on the image when there is no title', async () => {
      const root = await preview(
        `<mds-preview label="${LABEL}">${conditions}<iframe></iframe></mds-preview>`,
      );
      const lens = part(root, '.lens').getBoundingClientRect();
      const frame = part(root, '.frame').getBoundingClientRect();

      expect(part(root, '.box')).not.toHaveClass('has-head');
      expect(getComputedStyle(part(root, '.head')).position).toBe('absolute');
      expect(lens.top).toBeGreaterThanOrEqual(frame.top);
      expect(lens.right).toBeLessThanOrEqual(frame.right);
    });

    it('zooms to the width of the window with the lens, and emits mdsPreviewZoom', async () => {
      const root = await preview(
        `<mds-preview label="${LABEL}">${head}${conditions}<iframe></iframe></mds-preview>`,
      );
      const zoom = vi.fn();
      root.addEventListener('mdsPreviewZoom', (event) =>
        zoom((event as CustomEvent<{ zoomed: boolean }>).detail),
      );
      const small = part(root, '.box').getBoundingClientRect().width;

      await userEvent.click(page.getByRole('button', { name: 'Zoom the preview' }));

      await vi.waitFor(() => expect(root).toHaveAttribute('zoomed'));
      expect(zoom).toHaveBeenCalledWith({ zoomed: true });
      expect(part(root, '.lens')).toHaveAttribute('aria-pressed', 'true');
      expect(root.querySelector('[slot="conditions"]')).toBeVisible();
      await vi.waitFor(() =>
        expect(part(root, '.box').getBoundingClientRect().width).toBeGreaterThan(small),
      );
      const box = part(root, '.box');
      expect(box.getBoundingClientRect().left).toBeCloseTo(
        parseFloat(getComputedStyle(box).left),
        0,
      );
    });

    it('shrinks back with the lens', async () => {
      const root = await preview(
        `<mds-preview label="${LABEL}" zoomed>${head}<iframe></iframe></mds-preview>`,
      );
      const zoom = vi.fn();
      root.addEventListener('mdsPreviewZoom', (event) =>
        zoom((event as CustomEvent<{ zoomed: boolean }>).detail),
      );

      await userEvent.click(page.getByRole('button', { name: 'Zoom the preview' }));

      await vi.waitFor(() => expect(root.zoomed).toBe(false));
      expect(zoom).toHaveBeenCalledWith({ zoomed: false });
      expect(part(root, '.lens')).toHaveAttribute('aria-pressed', 'false');
    });

    it('shrinks back with Escape and gives the focus back to the lens', async () => {
      const root = await preview(
        `<mds-preview label="${LABEL}" zoomed>${head}${conditions}<iframe></iframe></mds-preview>`,
      );
      const zoom = vi.fn();
      root.addEventListener('mdsPreviewZoom', (event) =>
        zoom((event as CustomEvent<{ zoomed: boolean }>).detail),
      );

      root.querySelector<HTMLElement>('[slot="head"]')!.tabIndex = -1;
      root.querySelector<HTMLElement>('[slot="head"]')!.focus();
      await userEvent.keyboard('{Escape}');

      await vi.waitFor(() => expect(root.zoomed).toBe(false));
      expect(zoom).toHaveBeenCalledWith({ zoomed: false });
      await vi.waitFor(() => expect(root.shadowRoot!.activeElement).toBe(part(root, '.lens')));
    });

    it('emits nothing when zoomed is set by code', async () => {
      const root = await preview(`<mds-preview label="${LABEL}"><iframe></iframe></mds-preview>`);
      const zoom = vi.fn();
      root.addEventListener('mdsPreviewZoom', zoom);

      root.zoomed = true;
      await vi.waitFor(() => expect(root).toHaveAttribute('zoomed'));

      expect(zoom).not.toHaveBeenCalled();
    });
  });

  describe('in Italian', () => {
    useLanguage('it');

    beforeEach(async () => {
      await page.viewport(768, 680);
    });

    it('names the lens in the language of the page', async () => {
      const root = await preview(`<mds-preview label="${LABEL}"><iframe></iframe></mds-preview>`);

      expect(part(root, '.lens')).toHaveAttribute('aria-label', "Ingrandisci l'anteprima");
    });
  });
});
