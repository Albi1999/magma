import { inputTipPositionDictionary } from '../meta/dictionary';
import { h } from '@stencil/core';
import { StateCell, StatesGrid, stateCell } from '@fixture/states';
import { InputTipItemVariantType } from '@type/input-tip';
import { expect, waitFor } from 'storybook/test';

export default {
  title: 'UI / Forms / Input / Input Tip',
  id: 'form-input-tip',
  argTypes: {
    active: {
      type: { name: 'boolean' },
      description: 'Specifies if the component is active and shows expanded children or not',
    },
    position: {
      description: 'Specifies the position of the element relative to its container',
      options: inputTipPositionDictionary,
      control: { type: 'select' },
    },
  },
};

const Template = (args) => (
  <mds-input-tip {...args}>
    <mds-input-tip-item variant="required"></mds-input-tip-item>
    <mds-input-tip-item variant="disabled"></mds-input-tip-item>
    <mds-input-tip-item variant="readonly"></mds-input-tip-item>
  </mds-input-tip>
);

export const Default = {
  render: Template,
};

/**
 * Every state of the tip once the story has opened (#1440, @fixture/states). The tip stands on
 * the edge of a field: here a frame of the size of a field, as in a custom input wrapper, or a
 * real `mds-input` for the states only the focus of its field reaches (`play: true`), which the
 * play function brings there and checks on the tip, not on its look.
 */
interface TipItem {
  variant: InputTipItemVariantType;
  expanded?: boolean;
  text?: string;
}

interface TipState {
  state: string;
  play?: boolean;
  tip?: Record<string, string | boolean>;
  items?: TipItem[];
  style?: Record<string, string>;
  // the field whose focus brings its own tips there, for a play state
  field?: Record<string, string | number | boolean>;
}

const hint = 'Sedici caratteri, lettere e numeri';
const longHint =
  'Indica il codice fiscale del legale rappresentante e non la partita IVA della società: lo trovi sulla tessera sanitaria';

const tipStates: TipState[] = [
  { state: 'top', tip: { position: 'top' }, items: [{ variant: 'required' }] },
  {
    state: 'top, item expanded',
    tip: { position: 'top' },
    items: [{ variant: 'required', expanded: true }],
  },
  {
    state: 'top, active',
    tip: { position: 'top', active: true },
    items: [{ variant: 'required', expanded: true }],
  },
  {
    state: 'top, success item',
    tip: { position: 'top' },
    items: [{ variant: 'required-success' }],
  },
  {
    state: 'top, disabled item',
    tip: { position: 'top' },
    items: [{ variant: 'disabled', expanded: true }],
  },
  {
    state: 'top, several items',
    tip: { position: 'top' },
    items: [{ variant: 'readonly', expanded: true }, { variant: 'required-success' }],
  },
  {
    state: 'bottom',
    tip: { position: 'bottom' },
    items: [{ variant: 'text', expanded: true, text: hint }],
  },
  {
    state: 'bottom, active',
    tip: { position: 'bottom', active: true },
    items: [{ variant: 'text', expanded: true, text: hint }],
  },
  {
    state: 'bottom, item collapsed',
    tip: { position: 'bottom' },
    items: [{ variant: 'text', text: hint }],
  },
  {
    state: 'bottom, with a counter',
    tip: { position: 'bottom', active: true },
    items: [
      { variant: 'text', expanded: true, text: hint },
      { variant: 'count-incomplete', expanded: true, text: '8 / 16' },
    ],
  },
  {
    state: 'bottom, background of a variant',
    tip: { position: 'bottom' },
    items: [{ variant: 'text', expanded: true, text: 'Il codice fiscale non è valido' }],
    // what a field in error passes down, the colour of its variant
    style: { '--mds-input-tip-background': 'rgb(var(--magma-danger-emphasis))' },
  },
  {
    state: 'bottom, long text',
    tip: { position: 'bottom', active: true },
    items: [{ variant: 'text', expanded: true, text: longHint }],
  },
  { state: 'empty', tip: { position: 'bottom', active: true }, items: [] },
  {
    state: 'top, field focused',
    play: true,
    field: { 'aria-label': 'Email', type: 'email', required: true, placeholder: 'nome@dominio.it' },
  },
  {
    state: 'bottom, field focused',
    play: true,
    field: { 'aria-label': 'Codice fiscale', tip: hint, maxlength: 16, value: 'MRCRSS83' },
  },
];

const TemplateStates = () => (
  <StatesGrid>
    {tipStates.map(({ state, play, tip, items = [], style, field }) => (
      <StateCell key={state} state={state} play={play}>
        {field ? (
          <mds-input name={state} {...field}></mds-input>
        ) : (
          // a frame of the size of a field, which the tip is positioned against
          <div class="relative h-1200 rounded-xl border border-border-default bg-surface-overlay">
            <mds-input-tip {...tip} style={style}>
              {items.map(({ variant, expanded, text }) => (
                <mds-input-tip-item key={variant} variant={variant} expanded={expanded}>
                  {text}
                </mds-input-tip-item>
              ))}
            </mds-input-tip>
          </div>
        )}
      </StateCell>
    ))}
  </StatesGrid>
);

/**
 * Focuses the field of a cell as a person does, once every Magma element of the cell has
 * loaded, and returns its tips, the top one first. The event is sent, because focus() fires
 * nothing while the document has no focus (a background tab, a hidden pane of the browser).
 */
const focusField = async (cell: HTMLElement): Promise<HTMLMdsInputTipElement[]> => {
  const field = cell.querySelector('mds-input') as HTMLMdsInputElement;
  await waitFor(() => expect(field).toHaveAttribute('hydrated'));
  const native = field.shadowRoot!.querySelector('input.input') as HTMLElement;
  native.dispatchEvent(new FocusEvent('focus'));
  return Array.from(field.shadowRoot!.querySelectorAll('mds-input-tip'));
};

const playStates = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const [top] = await focusField(stateCell(canvasElement, 'top, field focused'));
  const [, bottom] = await focusField(stateCell(canvasElement, 'bottom, field focused'));
  // the property, not the attribute: Stencil reflects it on the next frame, and a hidden page
  // draws no frame
  await waitFor(() => expect(top).toHaveProperty('active', true));
  await waitFor(() => expect(bottom).toHaveProperty('active', true));
};

export const States = {
  render: TemplateStates,

  play: playStates,
};
