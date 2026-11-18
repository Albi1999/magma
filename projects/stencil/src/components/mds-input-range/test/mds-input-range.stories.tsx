import { h } from '@stencil/core';
import { useEffect } from 'react';
import { expect, waitFor } from 'storybook/test';
import { StateCell, StatesGrid, stateCell } from '@fixture/states';

export default {
  title: 'UI / Forms / Range',
  id: 'form-range',
  argTypes: {
    disabled: {
      type: { name: 'boolean' },
      description: 'Sets if the component is disabled',
    },
    min: {
      type: { name: 'number' },
      description: 'The lowest value in the range of permitted values',
    },
    max: {
      type: { name: 'number' },
      description: 'The greatest value in the range of permitted values',
    },
    step: {
      type: { name: 'number' },
      description:
        'The step attribute is a number that specifies the granularity that the value must adhere to, or the special value any, which is described below',
    },
    value: {
      type: { name: 'number' },
      description:
        'The value attribute contains a number which contains a representation of the selected number',
    },
  },
};

const Template = (args) => (
  <div class="grid gap-400">
    <mds-input-range {...args}>Range label</mds-input-range>
  </div>
);

const TemplateFormatLabel = (args) => {
  useEffect(() => {
    (document.querySelector('#custom-labeled') as HTMLMdsInputRangeElement).formatValue =
      formatValue;
  }, []);
  function formatValue(v: number) {
    return formatBytes(v);
  }

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    const value = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));
    return `${value} ${sizes[i]}`;
  };

  return (
    <div>
      <mds-input-range id="custom-labeled" {...args} step="1048576" min="0" max="1073741824">
        File size
      </mds-input-range>
    </div>
  );
};

const hideHeaderCss = `
  mds-input-range::part(header) {
    display: none;
  }
`;

const HideHeaderTemplate = (args) => (
  <div>
    <style>{hideHeaderCss}</style>
    <mds-input-range {...args}>This shouldn't be visible</mds-input-range>
  </div>
);

export const Default = {
  render: Template,
};

export const Disabled = {
  render: Template,

  args: {
    disabled: true,
  },
};

export const Min = {
  render: Template,

  args: {
    min: -100,
  },
};

export const Max = {
  render: Template,

  args: {
    max: 200,
  },
};

export const Step = {
  render: Template,

  args: {
    step: 10,
  },
};

export const Value = {
  render: Template,

  args: {
    value: 90,
  },
};

export const FormatLabel = {
  render: TemplateFormatLabel,
};

export const HideHeader = {
  render: HideHeaderTemplate,
};

// Several values on one track, an mds-input-range-value each (#1261)

const thumbsOf = (range: HTMLElement): HTMLInputElement[] =>
  Array.from(range.shadowRoot?.querySelectorAll<HTMLInputElement>('input.field') ?? []);

/** The thumbs of a range once it has hydrated: until then its host is hidden, and so are their names. */
const hydratedThumbs = async (range: HTMLElement, count: number): Promise<HTMLInputElement[]> => {
  await waitFor(() => expect(range).toHaveAttribute('hydrated'));
  await waitFor(() => expect(thumbsOf(range)).toHaveLength(count));
  return thumbsOf(range);
};

const valuesOf = (range: HTMLElement): number[] =>
  Array.from(range.querySelectorAll('mds-input-range-value')).map((value) => Number(value.value));

/**
 * Renders the story in dark: the mode of Magma is the one of the page, so the story sets it on
 * <html> while it runs, and the cleanup gives back the mode the page had.
 */
const inDark = () => {
  const html = document.documentElement;
  const modes = Array.from(html.classList).filter((name) => name.startsWith('pref-mode-'));
  const property = html.style.getPropertyValue('--magma-pref-mode');
  const marked = html.hasAttribute('data-magma-pref');
  html.classList.remove(...modes);
  html.classList.add('pref-mode-dark');
  html.style.setProperty('--magma-pref-mode', 'dark');
  html.setAttribute('data-magma-pref', '');
  return () => {
    html.classList.remove('pref-mode-dark');
    html.classList.add(...modes);
    if (property) html.style.setProperty('--magma-pref-mode', property);
    else html.style.removeProperty('--magma-pref-mode');
    if (!marked) html.removeAttribute('data-magma-pref');
  };
};

/** The play of a story in dark, once the range has taken the mode of the page. */
const inDarkPlay = (play) => async (context) => {
  const range = context.canvasElement.querySelector('mds-input-range') as HTMLMdsInputRangeElement;
  await waitFor(() => expect(range).toHaveAttribute('pref-mode', 'dark'));
  await play(context);
};

const euro = (value: number): string =>
  value.toLocaleString('it-IT', { currency: 'EUR', maximumFractionDigits: 0, style: 'currency' });

const PriceTemplate = () => (
  <div class="grid gap-400">
    <mds-input-range
      min={0}
      max={500}
      step={10}
      name="price"
      ref={(element?: HTMLMdsInputRangeElement) => {
        if (element) element.formatValue = euro;
      }}
    >
      Price
      <mds-input-range-value value={100}>Minimum</mds-input-range-value>
      <mds-input-range-value value={400}>Maximum</mds-input-range-value>
    </mds-input-range>
  </div>
);

// each thumb has its own name and its own ring; the keys stop the minimum at the maximum; the
// thumb moved from the keyboard shows its value in a tip over it
const playPrice = async ({ canvasElement, userEvent }) => {
  const range = canvasElement.querySelector('mds-input-range') as HTMLMdsInputRangeElement;
  const [minimum, maximum] = await hydratedThumbs(range, 2);
  await expect(minimum).toHaveAccessibleName('Minimum');
  await expect(maximum).toHaveAccessibleName('Maximum');

  minimum.focus();
  await userEvent.keyboard('{ArrowRight}');
  await expect(valuesOf(range)).toEqual([110, 400]);
  const tip = range.shadowRoot?.querySelector<HTMLElement>('.tip');
  await waitFor(() => expect(tip?.textContent?.trim()).toBe(euro(110)));
  await waitFor(() => expect(getComputedStyle(tip as HTMLElement).opacity).toBe('1'));

  await userEvent.keyboard('{End}');
  await expect(valuesOf(range)).toEqual([400, 400]);

  await userEvent.keyboard('{Home}');
  maximum.focus();
  await userEvent.keyboard('{PageDown}');
  await expect(valuesOf(range)).toEqual([0, 350]);
  await waitFor(() =>
    expect(range.shadowRoot?.querySelector('.value')?.textContent).toContain(' \u2013 '),
  );
};

export const SeveralValuesPrice = {
  render: PriceTemplate,
  play: playPrice,
};

export const SeveralValuesPriceDark = {
  render: PriceTemplate,
  beforeEach: inDark,
  play: inDarkPlay(playPrice),
};

const ContrastTemplate = () => (
  <div class="grid gap-400">
    <mds-input-range
      min={1}
      max={21}
      step={0.5}
      name="contrast"
      ref={(element?: HTMLMdsInputRangeElement) => {
        if (element) element.formatValue = (value: number) => `${value}:1`;
      }}
    >
      Contrast scale
      <mds-input-range-value value={3}></mds-input-range-value>
      <mds-input-range-value value={4.5}></mds-input-range-value>
      <mds-input-range-value value={5}></mds-input-range-value>
      <mds-input-range-value value={7}></mds-input-range-value>
    </mds-input-range>
  </div>
);

// two stops a step apart lie on each other: the arrows move the one with the focus, which lies on
// top (the e2e test reads it under the pointer), up to its neighbour, never past it, and never
// move the neighbour
const playContrast = async ({ canvasElement, userEvent }) => {
  const range = canvasElement.querySelector('mds-input-range') as HTMLMdsInputRangeElement;
  const third = (await hydratedThumbs(range, 4))[2];

  third.focus();
  await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
  await expect(valuesOf(range)).toEqual([3, 4.5, 4.5, 7]);
  await expect(range.shadowRoot?.activeElement).toBe(third);

  await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
  await expect(valuesOf(range)).toEqual([3, 4.5, 6, 7]);
};

export const SeveralValuesContrastScale = {
  render: ContrastTemplate,
  play: playContrast,
};

export const SeveralValuesContrastScaleDark = {
  render: ContrastTemplate,
  beforeEach: inDark,
  play: inDarkPlay(playContrast),
};

/**
 * Every state of the range once the story has opened (#1440, @fixture/states). The text of a
 * range is its label, as a product writes it; a state only an interaction reaches (`play: true`)
 * is brought there by the play function, which checks the value, not its look.
 */
interface RangeState {
  state: string;
  play?: boolean;
  label: string;
  range: Record<string, string | number | boolean>;
  // the values of a range that holds several, an mds-input-range-value each, with its name
  values?: { value: number; name?: string }[];
  format?: (value: number) => string;
  // the range in a disabled fieldset, which disables it as a native control
  fieldset?: boolean;
}

const price = { min: 0, max: 500, step: 10, name: 'prezzo' };
const priceValues = [
  { value: 100, name: 'Minimo' },
  { value: 400, name: 'Massimo' },
];
const discount = { min: 0, max: 50, step: 5, name: 'sconto' };

const rangeStates: RangeState[] = [
  { state: 'rest', label: 'Volume delle notifiche', range: { name: 'volume' } },
  { state: 'value', label: 'Luminosità dello schermo', range: { name: 'luminosita', value: 75 } },
  {
    state: 'min, max and step',
    label: 'Temperatura in gradi',
    range: { name: 'temperatura', min: 16, max: 30, step: 0.5, value: 21.5 },
  },
  { state: 'at min', label: 'Sconto in percentuale', range: { ...discount, value: 0 } },
  { state: 'at max', label: 'Sconto in percentuale', range: { ...discount, value: 50 } },
  { state: 'off the step', label: 'Sconto in percentuale', range: { ...discount, value: 23 } },
  {
    state: 'formatted value',
    label: 'Prezzo massimo',
    range: { name: 'prezzo-massimo', min: 0, max: 1000, step: 50, value: 350 },
    format: euro,
  },
  { state: 'several values', label: 'Prezzo', range: price, values: priceValues, format: euro },
  {
    state: 'several values, named by position',
    label: 'Scala di contrasto',
    range: { name: 'contrasto', min: 1, max: 21, step: 0.5 },
    values: [{ value: 3 }, { value: 4.5 }, { value: 7 }, { value: 12 }],
    format: (value: number) => `${value}:1`,
  },
  {
    state: 'disabled',
    label: 'Soglia di allerta',
    range: { name: 'soglia', value: 40, disabled: true },
  },
  {
    state: 'disabled, several values',
    label: 'Prezzo',
    range: { ...price, disabled: true },
    values: priceValues,
    format: euro,
  },
  {
    state: 'in a disabled fieldset',
    label: 'Soglia di allerta',
    range: { name: 'soglia', value: 40 },
    fieldset: true,
  },
  {
    state: 'long label',
    label: 'Percentuale di completamento richiesta prima del sopralluogo tecnico',
    range: { name: 'completamento', value: 60 },
  },
  {
    state: 'dragged',
    play: true,
    label: 'Volume delle notifiche',
    range: { name: 'volume', value: 30 },
  },
  {
    state: 'several values, moved from the keyboard',
    play: true,
    label: 'Prezzo',
    range: price,
    values: priceValues,
    format: euro,
  },
  {
    state: 'several values, minimum up to the maximum',
    play: true,
    label: 'Prezzo',
    range: price,
    values: priceValues,
    format: euro,
  },
];

const TemplateStates = () => (
  <StatesGrid>
    {rangeStates.map(({ state, play, label, range, values, format, fieldset }) => {
      const control = (
        <mds-input-range
          {...range}
          ref={(element?: HTMLMdsInputRangeElement) => {
            if (element && format) element.formatValue = format;
          }}
        >
          {label}
          {values?.map(({ value, name }) => (
            <mds-input-range-value key={`${value}`} value={value}>
              {name}
            </mds-input-range-value>
          ))}
        </mds-input-range>
      );
      return (
        <StateCell key={state} state={state} play={play}>
          {fieldset ? (
            <fieldset class="m-0 min-w-0 border-0 p-0" disabled>
              {control}
            </fieldset>
          ) : (
            control
          )}
        </StateCell>
      );
    })}
  </StatesGrid>
);

/** The range of a cell and its thumbs, once every Magma element of the cell has loaded. */
const loadedRange = async (canvasElement: HTMLElement, state: string) => {
  const cell = stateCell(canvasElement, state);
  const elements = Array.from(cell.querySelectorAll('*')).filter((element) =>
    element.tagName.startsWith('MDS-'),
  );
  await waitFor(() => elements.forEach((element) => expect(element).toHaveAttribute('hydrated')));
  const range = cell.querySelector('mds-input-range') as HTMLMdsInputRangeElement;
  const values = Array.from(cell.querySelectorAll('mds-input-range-value'));
  return { range, values, thumbs: thumbsOf(range) };
};

/** A key pressed on a thumb: the range handles the keys of several values itself. */
const pressKey = (thumb: HTMLInputElement, key: string) =>
  thumb.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

const playStates = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  // a drag ends in an input event on the native input, with its new value
  const dragged = await loadedRange(canvasElement, 'dragged');
  dragged.thumbs[0].value = '70';
  dragged.thumbs[0].dispatchEvent(new Event('input', { bubbles: true }));

  // Page Up moves a thumb by a tenth of the range, End takes it to its neighbour
  const moved = await loadedRange(canvasElement, 'several values, moved from the keyboard');
  pressKey(moved.thumbs[0], 'PageUp');
  const joined = await loadedRange(canvasElement, 'several values, minimum up to the maximum');
  pressKey(joined.thumbs[0], 'End');

  // the property, not the attribute: Stencil reflects it on the next frame, and a hidden page
  // draws no frame
  await waitFor(() => expect(dragged.range).toHaveProperty('value', 70));
  await waitFor(() => expect(moved.values[0]).toHaveProperty('value', 150));
  await waitFor(() => expect(moved.values[1]).toHaveProperty('value', 400));
  await waitFor(() => expect(joined.values[0]).toHaveProperty('value', 400));
  await waitFor(() => expect(joined.values[1]).toHaveProperty('value', 400));
};

export const States = {
  render: TemplateStates,

  play: playStates,
};
