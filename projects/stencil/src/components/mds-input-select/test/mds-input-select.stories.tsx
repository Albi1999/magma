import { citiesDictionary } from '@fixture/cities';
import { autoCompleteDictionary } from '@type/autocomplete';
import { themeStatusVariantDictionary } from '@type/variant';
import { h } from '@stencil/core';
import { StateCell, StatesGrid, stateCell } from '@fixture/states';
import { expect, waitFor } from 'storybook/test';

const cities = {};
citiesDictionary.map((element, index) => {
  cities[index] = element;
});

export default {
  title: 'UI / Forms / Select',
  id: 'form-select',
  argTypes: {
    value: {
      type: { name: 'string' },
      description: 'The selected value of the select',
    },
    autocomplete: {
      description: 'Specifies whether the element should have autocomplete enabled',
      options: autoCompleteDictionary,
      control: { type: 'select' },
    },
    autofocus: {
      type: { name: 'boolean' },
      description: 'Specifies that the element should automatically get focus when the page loads',
    },
    placeholder: {
      type: { name: 'string' },
      description: 'Specifies a short hint that describes the expected value of the element',
    },
    required: {
      type: { name: 'boolean' },
      description: 'Specifies that the element must be filled out before submitting the form',
    },
    disabled: {
      type: { name: 'boolean' },
      description: 'If true, the element is displayed as disabled',
    },
    multiple: {
      type: { name: 'boolean' },
      description: 'If true, the element allows multiple options to be selected in the list',
    },
    size: {
      type: { name: 'number' },
      description:
        'When multiple is set to true, represents the number of rows in the list that should be visible',
    },
    variant: {
      type: { name: 'string' },
      options: themeStatusVariantDictionary,
      control: { type: 'select' },
      description: 'Sets the variant of the component',
    },
    setValue: {
      type: { name: 'function' },
      description: 'Sets the value of the component',
    },
  },
};

const Template = (args) => (
  <mds-input-select aria-label="Film" {...args}>
    <option value="1">First contact</option>
    <option value="2">Second impact</option>
    <option value="3">The Third Man</option>
    <option value="4">The Fourth Emendament</option>
  </mds-input-select>
);

const TemplateForm = (args) => (
  <form
    class="flex gap-x-400"
    action="#"
    onSubmit={(event) => {
      event.preventDefault();

      console.log('Form submitted via mds-button', event.target?.[0].value);

      return false;
    }}
  >
    <mds-input-select aria-label="Film" {...args}>
      <option value="1">First contact</option>
      <option value="2">Second impact</option>
      <option value="3">The Third Man</option>
      <option value="4">The Fourth Emendament</option>
    </mds-input-select>
    <mds-button>Submit</mds-button>
  </form>
);

export const Default = {
  render: Template,

  args: {
    placeholder: 'Seleziona un film...',
  },
};

export const Multiple = {
  render: Template,

  args: {
    multiple: true,
  },
};

export const Required = {
  render: Template,

  args: {
    required: true,
    placeholder: 'Seleziona un film...',
  },
};

export const Disabled = {
  render: Template,

  args: {
    disabled: true,
  },
};

export const FormIntegrationWithPlaceholder = {
  render: TemplateForm,

  args: {
    placeholder: 'Seleziona un film...',
  },
};

export const FormIntegration = {
  render: TemplateForm,
};

/**
 * Every state of the select once the story has opened (#1440, @fixture/states). A select alone
 * is named by `aria-label`, as a product names it; a state only an interaction reaches
 * (`play: true`) is brought there by the play function, which focuses and chooses as a person
 * does and checks the state, not its look.
 */
type Option = [value: string, label: string];

interface SelectState {
  state: string;
  play?: boolean;
  fieldset?: boolean;
  select: Record<string, string | number | boolean>;
  // the options of the markup, the regions when left out
  options?: Option[];
  groups?: boolean;
}

const regions: Option[] = [
  ['lombardia', 'Lombardia'],
  ['veneto', 'Veneto'],
  ['toscana', 'Toscana'],
  ['lazio', 'Lazio'],
  ['campania', 'Campania'],
  ['sicilia', 'Sicilia'],
];
const areas: [string, Option[]][] = [
  ['Nord', regions.slice(0, 2)],
  ['Centro', regions.slice(2, 4)],
  ['Sud e isole', regions.slice(4)],
];
const offices: Option[] = [
  ['protocollo', 'Ufficio protocollo'],
  [
    'transizione',
    'Ufficio per la transizione al digitale e la conservazione dei documenti informatici della pubblica amministrazione',
  ],
];
const region = { 'aria-label': 'Regione', name: 'regione' };
const placeholder = 'Seleziona una regione';
const multiple = {
  'aria-label': 'Regioni di competenza',
  name: 'regioni',
  multiple: true,
  rows: 4,
};

const selectStates: SelectState[] = [
  { state: 'placeholder', select: { ...region, placeholder } },
  { state: 'value', select: { ...region, placeholder, value: 'toscana' } },
  { state: 'without placeholder', select: { ...region } },
  { state: 'required', select: { ...region, placeholder, required: true } },
  {
    state: 'required, with value',
    select: { ...region, placeholder, required: true, value: 'lazio' },
  },
  { state: 'required, focused', play: true, select: { ...region, placeholder, required: true } },
  {
    state: 'required, focused, chosen',
    play: true,
    select: { ...region, placeholder, required: true },
  },
  {
    state: 'variant error',
    select: { ...region, placeholder, variant: 'error', value: 'sicilia' },
  },
  {
    state: 'variant warning',
    select: { ...region, placeholder, variant: 'warning', value: 'campania' },
  },
  {
    state: 'variant success',
    select: { ...region, placeholder, variant: 'success', value: 'veneto' },
  },
  { state: 'variant info', select: { ...region, placeholder, variant: 'info' } },
  { state: 'disabled', select: { ...region, placeholder, disabled: true } },
  {
    state: 'disabled, with value',
    select: { ...region, placeholder, disabled: true, value: 'lombardia' },
  },
  { state: 'disabled by its fieldset', fieldset: true, select: { ...region, value: 'lombardia' } },
  { state: 'size sm', select: { ...region, size: 'sm', value: 'toscana' } },
  { state: 'size md', select: { ...region, size: 'md', value: 'toscana' } },
  { state: 'size lg', select: { ...region, size: 'lg', value: 'toscana' } },
  { state: 'multiple', select: multiple },
  { state: 'multiple, chosen', play: true, select: multiple },
  { state: 'rows 3', select: { ...region, rows: 3, value: 'veneto' } },
  { state: 'option groups', select: { ...region, placeholder, value: 'lazio' }, groups: true },
  {
    state: 'long option',
    select: { 'aria-label': 'Ufficio destinatario', name: 'ufficio', value: 'transizione' },
    options: offices,
  },
];

const renderOptions = (options: Option[]) =>
  options.map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));

const TemplateStates = () => (
  <StatesGrid>
    {selectStates.map(({ state, play, fieldset, select, options = regions, groups }) => {
      const control = (
        <mds-input-select {...select}>
          {groups
            ? areas.map(([area, list]) => (
                <optgroup key={area} label={area}>
                  {renderOptions(list)}
                </optgroup>
              ))
            : renderOptions(options)}
        </mds-input-select>
      );
      return (
        <StateCell key={state} state={state} play={play}>
          {fieldset ? (
            <fieldset disabled class="grid border-0 m-0 min-w-0 p-0">
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

/**
 * The native select of a cell, once every Magma element of the cell has loaded. Focus and the
 * choice are sent as events, because focus() fires nothing while the document has no focus (a
 * background tab, a hidden pane of the browser).
 */
const nativeSelect = async (host: HTMLMdsInputSelectElement): Promise<HTMLSelectElement> => {
  const cell = host.closest('[data-state]') as HTMLElement;
  const elements = Array.from(cell.querySelectorAll('*')).filter((element) =>
    element.tagName.startsWith('MDS-'),
  );
  await waitFor(() => elements.forEach((element) => expect(element).toHaveAttribute('hydrated')));
  return host.shadowRoot!.querySelector('select') as HTMLSelectElement;
};

const playStates = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  const select = (state: string) =>
    stateCell(canvasElement, state).querySelector('mds-input-select') as HTMLMdsInputSelectElement;
  // the only item of the top tip of an enabled select: the one of required
  const requiredTip = (state: string) =>
    select(state).shadowRoot!.querySelector('mds-input-tip mds-input-tip-item');

  const focused = await nativeSelect(select('required, focused'));
  focused.dispatchEvent(new FocusEvent('focus'));

  const chosen = await nativeSelect(select('required, focused, chosen'));
  chosen.dispatchEvent(new FocusEvent('focus'));
  chosen.value = 'veneto';
  chosen.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

  // two regions chosen in the list box, as a click with Ctrl or Cmd adds one
  const several = await nativeSelect(select('multiple, chosen'));
  several.dispatchEvent(new FocusEvent('focus'));
  Array.from(several.options).forEach((option) => {
    option.selected = ['veneto', 'toscana'].includes(option.value);
  });
  several.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  several.dispatchEvent(new FocusEvent('blur'));

  // the property, not the attribute: Stencil reflects it on the next frame, and a hidden page
  // draws no frame. The focus is no property of the select: the required item of its tip, which
  // opens while the select has the focus, says it was reached
  await waitFor(() => expect(requiredTip('required, focused')).toHaveProperty('expanded', true));
  await waitFor(() =>
    expect(select('required, focused, chosen')).toHaveProperty('value', 'veneto'),
  );
  await waitFor(() =>
    expect(requiredTip('required, focused, chosen')).toHaveProperty('variant', 'required-success'),
  );
  // value holds the first selected option, as select.value does
  await waitFor(() => expect(select('multiple, chosen')).toHaveProperty('value', 'veneto'));
};

export const States = {
  render: TemplateStates,

  play: playStates,
};
